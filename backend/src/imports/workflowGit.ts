import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * git in the Workflow repository, for the imports' review (ADR 0019): `GIT_BIN`, fixed arguments, cwd =
 * WORKFLOW_PATH, no shell. Paths only ever come from git's own `status` output — never from a client.
 */
export type WorkflowChange = { path: string; change: 'added' | 'modified' | 'deleted' };

/**
 * `git status --porcelain=v1 -z --untracked-files=all`: `XY <path>\0`, and for a rename/copy `XY <new>\0<old>\0`.
 * A rename shows as the new path added and the old one deleted — what accepting or discarding has to touch.
 */
export function parsePorcelainZ(stdout: string): WorkflowChange[] {
  const fields = stdout.split('\0');
  const changes: WorkflowChange[] = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i]!;
    if (entry.length < 4) continue;
    const [x, y, path] = [entry[0]!, entry[1]!, entry.slice(3)];
    if (x === 'R' || x === 'C') {
      const old = fields[++i];
      changes.push({ path, change: 'added' });
      if (x === 'R' && old) changes.push({ path: old, change: 'deleted' });
      continue;
    }
    if (x === '?' || x === 'A') changes.push({ path, change: 'added' });
    else if (x === 'D' || y === 'D') changes.push({ path, change: 'deleted' });
    else changes.push({ path, change: 'modified' });
  }
  return changes;
}

export type GitRunner = (args: string[], options?: { timeoutMs?: number }) => Promise<{ stdout: string }>;

/** Per file, in the review. A new file is shown whole, as added lines. */
export type FileDiff = WorkflowChange & { diff: string; truncated: boolean };

/** Bigger than this, a file's diff is cut (the review is for reading, not for every byte). */
export const MAX_DIFF_BYTES = 200 * 1024;
/** Paths per git command: well under Windows' 32 767-character command line. */
const PATHS_PER_CALL = 50;

/**
 * The absolute path of a repo-relative path from git's output — only if it stays inside the repo, also after
 * symlinks and junctions. Anything else is refused: nothing the review reads, deletes or restores leaves the repo.
 */
export function insideRepo(repo: string, path: string): string {
  const root = realpathSync.native(repo);
  const target = resolve(root, path);
  const inside = (candidate: string) => candidate === root || candidate.startsWith(root + sep);
  if (!inside(target)) throw new GitPathError(path);
  // The deepest part that exists decides: a junction anywhere on the way would show here.
  let existing = target;
  while (!existsSync(existing)) existing = dirname(existing);
  if (!inside(realpathSync.native(existing))) throw new GitPathError(path);
  return target;
}

export class GitPathError extends Error {
  override name = 'GitPathError';
  constructor(readonly path: string) {
    super(`path outside the Workflow repository: ${path}`);
  }
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += PATHS_PER_CALL) out.push(items.slice(i, i + PATHS_PER_CALL));
  return out;
}

export class WorkflowGit {
  private readonly run: GitRunner;
  private readonly repo: string;

  constructor({ gitBin, repo, run }: { gitBin: string; repo: string; run?: GitRunner }) {
    this.repo = repo;
    this.run =
      run ??
      ((args, { timeoutMs = 60_000 } = {}) =>
        execFileAsync(gitBin, args, {
          cwd: repo,
          windowsHide: true,
          maxBuffer: 16 * 1024 * 1024,
          timeout: timeoutMs,
          // Never wait for a credential prompt; `status` must not take the index lock from a running claude.
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
        }));
  }

  /** Everything the working tree has that HEAD does not — an import may only start when this is empty. */
  async changes(): Promise<WorkflowChange[]> {
    const { stdout } = await this.run(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    return parsePorcelainZ(stdout);
  }

  /** The review: `git diff` for what HEAD has, the file itself for what is new. */
  async diff(changes: WorkflowChange[]): Promise<FileDiff[]> {
    const files: FileDiff[] = [];
    for (const change of changes) {
      const absolute = insideRepo(this.repo, change.path);
      let diff: string;
      if (change.change === 'added') {
        const data = readFileSync(absolute);
        diff = data.includes(0)
          ? `(ficheiro binário, ${data.length} bytes)`
          : data
              .toString('utf8')
              .split(/\r?\n/)
              .map((line) => `+${line}`)
              .join('\n');
      } else {
        diff = (await this.run(['diff', '--no-color', '--no-ext-diff', '--', change.path])).stdout;
      }
      const truncated = Buffer.byteLength(diff) > MAX_DIFF_BYTES;
      files.push({ ...change, diff: truncated ? diff.slice(0, MAX_DIFF_BYTES) : diff, truncated });
    }
    return files;
  }

  /**
   * Accept: stages exactly these paths and commits them; the repo's own hooks run. A refused commit leaves
   * nothing staged. Returns the new commit's sha.
   */
  async commit(changes: WorkflowChange[], message: string): Promise<string> {
    const paths = changes.map((change) => change.path);
    for (const path of paths) insideRepo(this.repo, path);
    try {
      for (const batch of chunks(paths)) await this.run(['add', '--', ...batch]);
      // The Workflow's pre-commit audits the whole library: give it time.
      await this.run(['commit', '--quiet', '-m', message], { timeoutMs: 300_000 });
    } catch (error) {
      for (const batch of chunks(paths)) await this.run(['reset', '--quiet', '--', ...batch]).catch(() => undefined);
      throw error;
    }
    return (await this.run(['rev-parse', 'HEAD'])).stdout.trim();
  }

  /** Discard: restores what HEAD has, deletes what is new — and the folders that leaves empty. */
  async discard(changes: WorkflowChange[]): Promise<void> {
    const restored = changes.filter((change) => change.change !== 'added').map((change) => change.path);
    const created = changes.filter((change) => change.change === 'added').map((change) => insideRepo(this.repo, change.path));
    for (const path of restored) insideRepo(this.repo, path);
    for (const batch of chunks(restored)) await this.run(['checkout', '--', ...batch]);
    const root = realpathSync.native(this.repo);
    for (const file of created) {
      rmSync(file, { force: true });
      // Up to (never including) the repo root, while empty: the theme or stack folder the import made.
      for (let dir = dirname(file); dir !== root && dir.startsWith(root + sep); dir = dirname(dir)) {
        if (readdirSync(dir).length > 0) break;
        rmdirSync(dir);
      }
    }
  }
}
