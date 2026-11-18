import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { findRoot, resolveAllowedPath } from '../folders/cwdPolicy.js';
import { BRANCH_NAME } from '../state/state.schema.js';

const execFileAsync = promisify(execFile);

/** Why an environment got no tip (ADR 0034, point 7). A warning for the drawer, never an error. */
export type GitWarningReason = 'no-git' | 'no-repo' | 'outside-roots' | 'no-remote' | 'no-branch' | 'fetch-failed' | 'timeout';

export type BranchTip = { commit: string; at: string; subject: string };

export type ProjectGitRunner = (args: string[], options: { cwd: string; timeoutMs: number }) => Promise<{ stdout: string }>;

const TOPLEVEL_TIMEOUT_MS = 5_000;
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
export function classify(error: unknown, step: 'toplevel' | 'fetch' | 'log'): GitWarningReason {
  const e = error as ExecError;
  if (e.code === 'ENOENT') return 'no-git';
  if (e.killed || e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT') return 'timeout';
  if (step === 'toplevel') return 'no-repo';
  const stderr = String(e.stderr ?? '');
  if (step === 'fetch') {
    if (/does not appear to be a git repository|no such remote/i.test(stderr)) return 'no-remote';
    if (/couldn't find remote ref/i.test(stderr)) return 'no-branch';
  }
  return 'fetch-failed';
}

/**
 * git in a project's own repository, for the automatic deploys (ADR 0034): `GIT_BIN`, `execFile` without a
 * shell, only the three forms below. The cwd is the registry path re-validated against ALLOWED_ROOTS, and the
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
   * The tip of `origin/<branch>` for each branch, after fetching it — or why not. One fetch per distinct branch:
   * a branch the remote does not have fails the whole fetch, and should only fail its own environment.
   */
  async tips(projectPath: string, branches: readonly string[]): Promise<Map<string, BranchTip | GitWarningReason>> {
    const out = new Map<string, BranchTip | GitWarningReason>();
    const unique = [...new Set(branches)];
    const found = await this.repositoryRoot(projectPath);
    for (const branch of unique) out.set(branch, 'reason' in found ? found.reason : await this.tip(found.root, branch));
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

  private async tip(cwd: string, branch: string): Promise<BranchTip | GitWarningReason> {
    // Validated when saved; checked again because this string becomes part of an argv.
    if (!BRANCH_NAME.test(branch)) return 'no-branch';
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
      if (!commit || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commit) || !at || Number.isNaN(at.getTime())) return 'fetch-failed';
      return { commit, at: at.toISOString(), subject: subject.trim() };
    } catch (error) {
      return classify(error, 'log');
    }
  }
}
