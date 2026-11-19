import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { findRoot, resolveAllowedPath } from '../folders/cwdPolicy.js';
import { BRANCH_NAME } from '../state/state.schema.js';

const execFileAsync = promisify(execFile);
const HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** Why an environment got no tip (ADR 0034, point 7). A warning for the drawer, never an error. */
export type GitWarningReason = 'no-git' | 'no-repo' | 'outside-roots' | 'no-remote' | 'no-branch' | 'fetch-failed' | 'timeout';

export type BranchTip = { commit: string; at: string; subject: string };

/** The remote tip is one every environment of that branch has already seen (ADR 0035): nothing was fetched. */
export const UNCHANGED = 'unchanged';
export type BranchResult = BranchTip | GitWarningReason | typeof UNCHANGED;

export type ProjectGitRunner = (args: string[], options: { cwd: string; timeoutMs: number }) => Promise<{ stdout: string }>;

const TOPLEVEL_TIMEOUT_MS = 5_000;
const LS_REMOTE_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 15_000;
const LOG_TIMEOUT_MS = 5_000;

/** The child's environment: never a prompt (terminal, Git Credential Manager window, SSH passphrase), no optional locks. */
export function gitEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_OPTIONAL_LOCKS: '0' };
  // The owner's own SSH choice wins; otherwise ssh must fail instead of asking.
  if (!base.GIT_SSH_COMMAND && !base.GIT_SSH) env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';
  return env;
}

type ExecError = Error & { code?: string | number; killed?: boolean; signal?: string | null; stderr?: string };

/** What a failed git call means; stderr is read here only and never leaves this file (it may hold remote URLs). */
export function classify(error: unknown, step: 'toplevel' | 'ls-remote' | 'fetch' | 'log'): GitWarningReason {
  const e = error as ExecError;
  if (e.code === 'ENOENT') return 'no-git';
  if (e.killed || e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT') return 'timeout';
  if (step === 'toplevel') return 'no-repo';
  const stderr = String(e.stderr ?? '');
  if (step === 'fetch' || step === 'ls-remote') {
    if (/does not appear to be a git repository|no such remote/i.test(stderr)) return 'no-remote';
    if (/couldn't find remote ref/i.test(stderr)) return 'no-branch';
  }
  return 'fetch-failed';
}

/**
 * git in a project's own repository, for the automatic deploys (ADR 0034, 0035): `GIT_BIN`, `execFile` without a
 * shell, only the four forms below. The cwd is the registry path re-validated against ALLOWED_ROOTS, and the
 * repository root it belongs to has to be inside them too. Never touches the working tree or the index.
 */
export class ProjectGit {
  private readonly run: ProjectGitRunner;
  private readonly allowedRoots: readonly string[];

  constructor({ gitBin, allowedRoots, run }: { gitBin: string; allowedRoots: readonly string[]; run?: ProjectGitRunner }) {
    this.allowedRoots = allowedRoots;
    this.run =
      run ??
      ((args, { cwd, timeoutMs }) =>
        execFileAsync(gitBin, args, { cwd, windowsHide: true, maxBuffer: 1024 * 1024, timeout: timeoutMs, env: gitEnv() }));
  }

  /**
   * The tip of `origin/<branch>` for each branch — or why not. `ls-remote` first (ADR 0035): a tip that `isKnown`
   * says was already seen is `unchanged`, and nothing is fetched; otherwise fetch and log it (ADR 0034). One call
   * per distinct branch: a branch the remote does not have should only fail its own environment.
   */
  async tips(
    projectPath: string,
    branches: readonly string[],
    isKnown: (branch: string, commit: string) => boolean = () => false,
  ): Promise<Map<string, BranchResult>> {
    const out = new Map<string, BranchResult>();
    const unique = [...new Set(branches)];
    const found = await this.repositoryRoot(projectPath);
    for (const branch of unique) out.set(branch, 'reason' in found ? found.reason : await this.tip(found.root, branch, isKnown));
    return out;
  }

  /** The real path of the repository root, or why there is none to use. */
  private async repositoryRoot(projectPath: string): Promise<{ root: string } | { reason: GitWarningReason }> {
    let cwd: string;
    try {
      cwd = resolveAllowedPath(projectPath, this.allowedRoots);
    } catch {
      return { reason: 'outside-roots' };
    }
    let toplevel: string;
    try {
      toplevel = (await this.run(['rev-parse', '--show-toplevel'], { cwd, timeoutMs: TOPLEVEL_TIMEOUT_MS })).stdout.trim();
    } catch (error) {
      return { reason: classify(error, 'toplevel') };
    }
    if (!toplevel) return { reason: 'no-repo' };
    let real: string;
    try {
      real = realpathSync.native(resolve(toplevel));
    } catch {
      return { reason: 'no-repo' };
    }
    const realRoots = this.allowedRoots.flatMap((rootPath) => {
      try {
        return [realpathSync.native(rootPath)];
      } catch {
        return [];
      }
    });
    return findRoot(real, realRoots) ? { root: real } : { reason: 'outside-roots' };
  }

  /** The hash `origin` has for the branch, without writing to the repository. */
  private async remoteHash(cwd: string, branch: string): Promise<string | GitWarningReason> {
    const ref = `refs/heads/${branch}`;
    let stdout: string;
    try {
      ({ stdout } = await this.run(['-c', 'credential.interactive=false', 'ls-remote', '--end-of-options', 'origin', ref], {
        cwd,
        timeoutMs: LS_REMOTE_TIMEOUT_MS,
      }));
    } catch (error) {
      return classify(error, 'ls-remote');
    }
    // The pattern matches by the end (`x/refs/heads/main` too): only the exact ref counts.
    for (const line of stdout.split(/\r?\n/)) {
      const [hash, name] = line.split('\t');
      if (name?.trim() === ref) return hash && HASH.test(hash) ? hash : 'fetch-failed';
    }
    return 'no-branch';
  }

  private async tip(cwd: string, branch: string, isKnown: (branch: string, commit: string) => boolean): Promise<BranchResult> {
    // Validated when saved; checked again because this string becomes part of an argv.
    if (!BRANCH_NAME.test(branch)) return 'no-branch';
    const hash = await this.remoteHash(cwd, branch);
    if (!HASH.test(hash)) return hash as GitWarningReason;
    if (isKnown(branch, hash)) return UNCHANGED;
    const remoteRef = `refs/remotes/origin/${branch}`;
    try {
      await this.run(
        [
          '-c', 'gc.auto=0',
          '-c', 'credential.interactive=false',
          'fetch', '--no-tags', '--no-write-fetch-head', '--end-of-options',
          'origin', `+refs/heads/${branch}:${remoteRef}`,
        ],
        { cwd, timeoutMs: FETCH_TIMEOUT_MS },
      );
    } catch (error) {
      return classify(error, 'fetch');
    }
    try {
      const { stdout } = await this.run(['log', '-1', '--format=%H%x00%cI%x00%s', '--end-of-options', remoteRef], {
        cwd,
        timeoutMs: LOG_TIMEOUT_MS,
      });
      const [commit, date, subject = ''] = stdout.replace(/\r?\n$/, '').split('\0');
      const at = date ? new Date(date) : undefined;
      if (!commit || !HASH.test(commit) || !at || Number.isNaN(at.getTime())) return 'fetch-failed';
      return { commit, at: at.toISOString(), subject: subject.trim() };
    } catch (error) {
      return classify(error, 'log');
    }
  }
}
