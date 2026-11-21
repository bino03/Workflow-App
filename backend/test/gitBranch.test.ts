import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitBranchReader } from '../src/terminals/gitBranch.js';

let base: string;
let root: string;

function head(dir: string, content: string): void {
  writeFileSync(join(dir, 'HEAD'), content);
}

beforeAll(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-branch-')));
  root = join(base, 'root');
  // repo/ with a branch, and a subfolder of it.
  mkdirSync(join(root, 'repo', '.git'), { recursive: true });
  mkdirSync(join(root, 'repo', 'src', 'deep'), { recursive: true });
  head(join(root, 'repo', '.git'), 'ref: refs/heads/feat/ws-auth\n');
  // detached/ with a commit hash in HEAD.
  mkdirSync(join(root, 'detached', '.git'), { recursive: true });
  head(join(root, 'detached', '.git'), '0123456789abcdef0123456789abcdef01234567\n');
  // worktree/ with a `.git` file pointing to its git dir (relative).
  mkdirSync(join(root, 'repo', '.git', 'worktrees', 'wt'), { recursive: true });
  head(join(root, 'repo', '.git', 'worktrees', 'wt'), 'ref: refs/heads/fix/1\n');
  mkdirSync(join(root, 'worktree'));
  writeFileSync(join(root, 'worktree', '.git'), 'gitdir: ../repo/.git/worktrees/wt\n');
  // weird/ with a name no branch can have.
  mkdirSync(join(root, 'weird', '.git'), { recursive: true });
  head(join(root, 'weird', '.git'), 'ref: refs/heads/../../etc\n');
  // plain/ with no repository; a repository *above* the root must not count.
  mkdirSync(join(root, 'plain'));
  mkdirSync(join(base, '.git'));
  head(join(base, '.git'), 'ref: refs/heads/outside\n');
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('GitBranchReader', () => {
  it('reads the branch of the repository folder and of its subfolders', () => {
    const reader = new GitBranchReader([root]);
    expect(reader.branchOf(join(root, 'repo'))).toBe('feat/ws-auth');
    expect(reader.branchOf(join(root, 'repo', 'src', 'deep'))).toBe('feat/ws-auth');
  });

  it('follows the gitdir pointer of a worktree', () => {
    expect(new GitBranchReader([root]).branchOf(join(root, 'worktree'))).toBe('fix/1');
  });

  it('is null with a detached HEAD, an invalid name, or no repository', () => {
    const reader = new GitBranchReader([root]);
    expect(reader.branchOf(join(root, 'detached'))).toBeNull();
    expect(reader.branchOf(join(root, 'weird'))).toBeNull();
    expect(reader.branchOf(join(root, 'plain'))).toBeNull();
  });

  it('never looks above the allowed root, nor outside every root', () => {
    expect(new GitBranchReader([root]).branchOf(join(root, 'plain'))).toBeNull();
    expect(new GitBranchReader([join(root, 'repo')]).branchOf(base)).toBeNull();
  });

  it('caches for a few seconds, then sees a checkout', () => {
    let now = 0;
    const reader = new GitBranchReader([root], () => now);
    const gitDir = join(root, 'repo', '.git');
    expect(reader.branchOf(join(root, 'repo'))).toBe('feat/ws-auth');
    head(gitDir, 'ref: refs/heads/main\n');
    now = 1_000;
    expect(reader.branchOf(join(root, 'repo'))).toBe('feat/ws-auth');
    now = 3_000;
    expect(reader.branchOf(join(root, 'repo'))).toBe('main');
    head(gitDir, 'ref: refs/heads/feat/ws-auth\n');
  });
});
