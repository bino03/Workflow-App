import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkflowGit, parsePorcelainZ } from '../src/imports/workflowGit.js';

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
});
