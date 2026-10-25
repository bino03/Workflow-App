import { execFile } from 'node:child_process';
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

export type GitRunner = (args: string[]) => Promise<{ stdout: string }>;

export class WorkflowGit {
  private readonly run: GitRunner;

  constructor({ gitBin, repo, run }: { gitBin: string; repo: string; run?: GitRunner }) {
    this.run =
      run ??
      ((args) =>
        execFileAsync(gitBin, args, {
          cwd: repo,
          windowsHide: true,
          maxBuffer: 16 * 1024 * 1024,
          timeout: 60_000,
          // Never wait for a credential prompt; `status` must not take the index lock from a running claude.
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
        }));
  }

  /** Everything the working tree has that HEAD does not — an import may only start when this is empty. */
  async changes(): Promise<WorkflowChange[]> {
    const { stdout } = await this.run(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    return parsePorcelainZ(stdout);
  }
}
