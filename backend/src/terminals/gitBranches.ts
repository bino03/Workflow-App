import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { BRANCH_NAME } from '../state/state.schema.js';
import { findGitDir } from './gitBranch.js';

/** Enough for a sidebar group; a repository with more is not browsed from there. */
export const MAX_BRANCHES = 50;

const HEAD_REF = /^ref: refs\/heads\/(.+)$/;
const PACKED_HEAD = /^[0-9a-f]{40,64} refs\/heads\/(.+)$/;

export type BranchList = { current: string | null; branches: string[] };

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** Loose refs under `refs/heads`, as names (`feat/x`). Depth-limited: a branch name has a few `/` at most. */
function looseBranches(headsDir: string, prefix = '', depth = 0): string[] {
  if (depth > 5) return [];
  let entries;
  try {
    entries = readdirSync(join(headsDir, prefix), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return looseBranches(headsDir, name, depth + 1);
    return entry.isFile() ? [name] : [];
  });
}

/**
 * The local branches of the repository that holds `cwd`, for the sidebar (proposta C, ADR 0036). Read from the git
 * directory as files (`refs/heads` + `packed-refs`, in the common dir of a worktree), never by running git — same
 * rule as the pane header's branch. Only plain branch names; the current one first, then by name.
 */
export function listBranches(cwd: string, allowedRoots: readonly string[]): BranchList {
  const gitDir = findGitDir(cwd, allowedRoots);
  if (!gitDir) return { current: null, branches: [] };
  const pointer = readText(join(gitDir, 'commondir'))?.trim();
  const commonDir = pointer ? (isAbsolute(pointer) ? pointer : resolve(gitDir, pointer)) : gitDir;

  const head = readText(join(gitDir, 'HEAD'))?.trim().match(HEAD_REF)?.[1];
  const current = head && BRANCH_NAME.test(head) ? head : null;

  const packed = (readText(join(commonDir, 'packed-refs')) ?? '')
    .split(/\r?\n/)
    .map((line) => line.match(PACKED_HEAD)?.[1])
    .filter((name): name is string => !!name);
  const names = [...new Set([...looseBranches(join(commonDir, 'refs', 'heads')), ...packed])].filter((name) => BRANCH_NAME.test(name));
  names.sort((a, b) => (a === current ? -1 : b === current ? 1 : a.localeCompare(b)));
  return { current, branches: names.slice(0, MAX_BRANCHES) };
}
