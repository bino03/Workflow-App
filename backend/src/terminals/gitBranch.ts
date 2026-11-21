import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { findRoot, isInsideRoot } from '../folders/cwdPolicy.js';
import { BRANCH_NAME } from '../state/state.schema.js';

/** `GET /terminals` is polled; a branch changed by `git checkout` shows up within this window. */
const CACHE_MS = 3_000;
const HEAD_REF = /^ref: refs\/heads\/(.+)$/;
const GITDIR = /^gitdir: (.+)$/;

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The git directory of the repository that holds `cwd`: the nearest `.git` going up, but never above the
 * ALLOWED_ROOTS root the folder is in (ADR 0004). A `.git` file is a worktree or submodule: `gitdir: <path>`.
 */
export function findGitDir(cwd: string, roots: readonly string[]): string | undefined {
  const root = findRoot(cwd, roots);
  if (!root) return undefined;
  for (let dir = cwd; isInsideRoot(dir, root); dir = dirname(dir)) {
    const dotGit = join(dir, '.git');
    if (exists(join(dotGit, 'HEAD'))) return dotGit;
    const pointer = readText(dotGit)?.trim().match(GITDIR)?.[1];
    if (pointer) return isAbsolute(pointer) ? pointer : resolve(dir, pointer);
    if (dirname(dir) === dir) break;
  }
  return undefined;
}

/**
 * The current branch of a terminal's folder, for the pane header (ADR 0036, phase 3). Reads `.git/HEAD` as a
 * file — never runs git (no process per poll, nothing the folder's config can hook). null outside a repository,
 * with a detached HEAD, or a name that is not a plain branch name.
 */
export class GitBranchReader {
  private readonly cache = new Map<string, { at: number; branch: string | null }>();

  constructor(
    private readonly allowedRoots: readonly string[],
    private readonly now: () => number = Date.now,
  ) {}

  branchOf(cwd: string): string | null {
    const cached = this.cache.get(cwd);
    const at = this.now();
    if (cached && at - cached.at < CACHE_MS) return cached.branch;
    const branch = this.readBranch(cwd);
    this.cache.set(cwd, { at, branch });
    return branch;
  }

  private readBranch(cwd: string): string | null {
    const gitDir = findGitDir(cwd, this.allowedRoots);
    if (!gitDir) return null;
    const name = readText(join(gitDir, 'HEAD'))?.trim().match(HEAD_REF)?.[1];
    return name && BRANCH_NAME.test(name) ? name : null;
  }
}
