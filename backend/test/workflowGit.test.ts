import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitPathError, MAX_DIFF_BYTES, WorkflowGit, insideRepo, parsePorcelainZ } from '../src/imports/workflowGit.js';

describe('parsePorcelainZ', () => {
  it('untracked and added → added; deleted in either column → deleted; the rest → modified', () => {
    expect(parsePorcelainZ('?? library/new/THEME.md\0 M docs/provenance.md\0 D old.md\0D  gone.md\0A  staged.md\0MM both.md\0')).toEqual([
      { path: 'library/new/THEME.md', change: 'added' },
      { path: 'docs/provenance.md', change: 'modified' },
      { path: 'old.md', change: 'deleted' },
      { path: 'gone.md', change: 'deleted' },
      { path: 'staged.md', change: 'added' },
      { path: 'both.md', change: 'modified' },
    ]);
  });

  it('a rename is the new path added and the old one deleted; paths with spaces survive', () => {
    expect(parsePorcelainZ('R  new name.md\0old name.md\0')).toEqual([
      { path: 'new name.md', change: 'added' },
      { path: 'old name.md', change: 'deleted' },
    ]);
    expect(parsePorcelainZ('')).toEqual([]);
  });
});

describe('WorkflowGit (a real repository)', () => {
  let repo: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, windowsHide: true });

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'wfa-git-'));
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    writeFileSync(join(repo, 'kept.md'), 'kept\n');
    writeFileSync(join(repo, 'gone.md'), 'gone\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('changes(): a clean tree is empty; then new (also inside a new folder), modified and deleted show up', async () => {
    const workflow = new WorkflowGit({ gitBin: 'git', repo });
    expect(await workflow.changes()).toEqual([]);

    mkdirSync(join(repo, 'library', 'themes', 'x'), { recursive: true });
    writeFileSync(join(repo, 'library', 'themes', 'x', 'THEME.md'), 'new\n');
    writeFileSync(join(repo, 'kept.md'), 'changed\n');
    unlinkSync(join(repo, 'gone.md'));

    expect((await workflow.changes()).sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: 'gone.md', change: 'deleted' },
      { path: 'kept.md', change: 'modified' },
      { path: 'library/themes/x/THEME.md', change: 'added' },
    ]);
  });

  it('a folder that is not a repository rejects', async () => {
    const notRepo = mkdtempSync(join(tmpdir(), 'wfa-not-git-'));
    try {
      await expect(new WorkflowGit({ gitBin: 'git', repo: notRepo }).changes()).rejects.toBeDefined();
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });

  /** One new file (in new folders), one modified, one deleted — what an import leaves. */
  function importLeftovers() {
    mkdirSync(join(repo, 'library', 'themes', 'x'), { recursive: true });
    writeFileSync(join(repo, 'library', 'themes', 'x', 'THEME.md'), 'line 1\nline 2\n');
    writeFileSync(join(repo, 'kept.md'), 'changed\n');
    unlinkSync(join(repo, 'gone.md'));
  }

  it('diff: git diff for modified/deleted, the whole file as + lines for a new one; binary and big files are not dumped', async () => {
    const workflow = new WorkflowGit({ gitBin: 'git', repo });
    importLeftovers();
    writeFileSync(join(repo, 'preview.png'), Buffer.from([0x89, 0x50, 0x00, 0x01]));
    writeFileSync(join(repo, 'big.md'), 'x'.repeat(MAX_DIFF_BYTES + 10));
    const files = await workflow.diff(await workflow.changes());
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]));
    expect(byPath['library/themes/x/THEME.md']).toMatchObject({ change: 'added', diff: '+line 1\n+line 2\n+', truncated: false });
    expect(byPath['kept.md']!.diff).toContain('-kept');
    expect(byPath['kept.md']!.diff).toContain('+changed');
    expect(byPath['gone.md']).toMatchObject({ change: 'deleted' });
    expect(byPath['gone.md']!.diff).toContain('-gone');
    expect(byPath['preview.png']!.diff).toBe('(ficheiro binário, 4 bytes)');
    expect(byPath['big.md']).toMatchObject({ truncated: true });
    expect(byPath['big.md']!.diff.length).toBe(MAX_DIFF_BYTES);
  });

  it('commit: exactly those paths in one commit with the message; the tree is clean after', async () => {
    const workflow = new WorkflowGit({ gitBin: 'git', repo });
    importLeftovers();
    const sha = await workflow.commit(await workflow.changes(), 'feat: acrescenta o design x à biblioteca');
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(git('log', '-1', '--format=%s').toString().trim()).toBe('feat: acrescenta o design x à biblioteca');
    expect(git('show', '--name-status', '--format=', 'HEAD').toString().trim().split(/\r?\n/).sort()).toEqual([
      'A\tlibrary/themes/x/THEME.md',
      'D\tgone.md',
      'M\tkept.md',
    ]);
    expect(await workflow.changes()).toEqual([]);
  });

  it('a pre-commit hook that refuses → the commit rejects and nothing stays staged', async () => {
    mkdirSync(join(repo, 'hooks'));
    writeFileSync(join(repo, 'hooks', 'pre-commit'), '#!/bin/sh\necho "✗ A biblioteca tem erros" >&2\nexit 1\n');
    git('config', 'core.hooksPath', 'hooks');
    git('add', 'hooks');
    git('-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'hook');
    const workflow = new WorkflowGit({ gitBin: 'git', repo });
    importLeftovers();
    const before = git('rev-parse', 'HEAD').toString();
    await expect(workflow.commit(await workflow.changes(), 'feat: x')).rejects.toMatchObject({ stderr: expect.stringContaining('A biblioteca tem erros') });
    expect(git('rev-parse', 'HEAD').toString()).toBe(before);
    expect(git('diff', '--cached', '--name-only').toString()).toBe('');
  });

  it('discard: HEAD is back and the new files and folders are gone — git status is clean', async () => {
    const workflow = new WorkflowGit({ gitBin: 'git', repo });
    importLeftovers();
    await workflow.discard(await workflow.changes());
    expect(await workflow.changes()).toEqual([]);
    expect(existsSync(join(repo, 'library'))).toBe(false);
    expect(readFileSync(join(repo, 'kept.md'), 'utf8').replace(/\r\n/g, '\n')).toBe('kept\n');
  });

  it('insideRepo refuses a path that leaves the repo, also through a junction', () => {
    const outside = mkdtempSync(join(tmpdir(), 'wfa-git-outside-'));
    try {
      writeFileSync(join(outside, 'secret.md'), 'x');
      symlinkSync(outside, join(repo, 'link'), 'junction');
      expect(() => insideRepo(repo, '../escape.md')).toThrow(GitPathError);
      expect(() => insideRepo(repo, 'link/secret.md')).toThrow(GitPathError);
      expect(insideRepo(repo, 'kept.md')).toBe(join(realpathSync.native(repo), 'kept.md'));
    } finally {
      rmSync(join(repo, 'link'), { force: true, recursive: false });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
