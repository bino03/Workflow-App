import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_BRANCHES, listBranches } from '../src/terminals/gitBranches.js';

const HASH = '0123456789abcdef0123456789abcdef01234567';
let base: string;
let root: string;

function ref(gitDir: string, name: string): void {
  const file = join(gitDir, 'refs', 'heads', ...name.split('/'));
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${HASH}\n`);
}

beforeAll(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-branches-')));
  root = join(base, 'root');
  // repo/: loose refs (one nested), packed refs (one duplicated), a tag that must not count, HEAD on feat/ws-auth.
  const git = join(root, 'repo', '.git');
  mkdirSync(git, { recursive: true });
  writeFileSync(join(git, 'HEAD'), 'ref: refs/heads/feat/ws-auth\n');
  ref(git, 'main');
  ref(git, 'feat/ws-auth');
  writeFileSync(
    join(git, 'packed-refs'),
    ['# pack-refs with: peeled fully-peeled sorted', `${HASH} refs/heads/feat/ide-shell`, `${HASH} refs/heads/main`, `${HASH} refs/tags/v1`, `^${HASH}`, ''].join('\n'),
  );
  // worktree/: its own HEAD, the branches from the common dir.
  const wt = join(git, 'worktrees', 'wt');
  mkdirSync(wt, { recursive: true });
  writeFileSync(join(wt, 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(wt, 'commondir'), '../..\n');
  mkdirSync(join(root, 'worktree'));
  writeFileSync(join(root, 'worktree', '.git'), 'gitdir: ../repo/.git/worktrees/wt\n');
  // many/: more branches than the cap.
  const many = join(root, 'many', '.git');
  mkdirSync(many, { recursive: true });
  writeFileSync(join(many, 'HEAD'), `${HASH}\n`);
  for (let i = 0; i < MAX_BRANCHES + 5; i += 1) ref(many, `b${String(i).padStart(3, '0')}`);
  // plain/: no repository (and one above the root must not count).
  mkdirSync(join(root, 'plain'));
  mkdirSync(join(base, '.git'));
  writeFileSync(join(base, '.git', 'HEAD'), 'ref: refs/heads/outside\n');
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('listBranches (proposta C, ADR 0036)', () => {
  it('lists loose and packed branches once, current first, then by name; no tags', () => {
    expect(listBranches(join(root, 'repo'), [root])).toEqual({ current: 'feat/ws-auth', branches: ['feat/ws-auth', 'feat/ide-shell', 'main'] });
  });

  it('works from a subfolder of the repository', () => {
    mkdirSync(join(root, 'repo', 'src'), { recursive: true });
    expect(listBranches(join(root, 'repo', 'src'), [root]).current).toBe('feat/ws-auth');
  });

  it('a worktree reads its own HEAD and the common dir branches', () => {
    expect(listBranches(join(root, 'worktree'), [root])).toEqual({ current: 'main', branches: ['main', 'feat/ide-shell', 'feat/ws-auth'] });
  });

  it(`caps at ${MAX_BRANCHES}; a detached HEAD has no current`, () => {
    const list = listBranches(join(root, 'many'), [root]);
    expect(list.current).toBeNull();
    expect(list.branches).toHaveLength(MAX_BRANCHES);
  });

  it('no repository inside the root → empty, never the one above it', () => {
    expect(listBranches(join(root, 'plain'), [root])).toEqual({ current: null, branches: [] });
  });
});
