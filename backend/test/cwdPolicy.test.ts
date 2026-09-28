import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors.js';
import { findRoot, isInsideRoot, resolveAllowedPath } from '../src/folders/cwdPolicy.js';

const isWindows = process.platform === 'win32';

let base: string;
let root: string;
let roots: string[];

beforeAll(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-cwd-')));
  root = join(base, 'root');
  mkdirSync(join(root, 'app', 'src'), { recursive: true });
  mkdirSync(join(base, 'root2'));
  mkdirSync(join(base, 'outside'));
  writeFileSync(join(root, 'notes.txt'), 'x');
  // Junctions need no admin rights on Windows; on other systems a dir symlink does the same job.
  symlinkSync(join(base, 'outside'), join(root, 'escape'), isWindows ? 'junction' : 'dir');
  symlinkSync(join(root, 'app'), join(root, 'shortcut'), isWindows ? 'junction' : 'dir');
  roots = [root];
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

function expectFolderError(input: string, allowed = roots) {
  let caught: unknown;
  try {
    resolveAllowedPath(input, allowed);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe('FOLDER_001');
}

describe('resolveAllowedPath', () => {
  it('accepts the root itself and folders below it, returning the real path', () => {
    expect(resolveAllowedPath(root, roots)).toBe(root);
    expect(resolveAllowedPath(join(root, 'app', 'src'), roots)).toBe(join(root, 'app', 'src'));
  });

  it('resolves .. before checking — climbing out of the root is refused', () => {
    expectFolderError(join(root, 'app', '..', '..', 'outside'));
    expect(resolveAllowedPath(join(root, 'app', 'src', '..'), roots)).toBe(join(root, 'app'));
  });

  it('follows junctions: one pointing outside is refused, one pointing inside resolves to its target', () => {
    expectFolderError(join(root, 'escape'));
    expect(resolveAllowedPath(join(root, 'shortcut'), roots)).toBe(join(root, 'app'));
  });

  it('refuses a sibling whose name starts like the root (root2 vs root)', () => {
    expectFolderError(join(base, 'root2'));
  });

  it('refuses missing folders, files, relative paths, empty and NUL', () => {
    expectFolderError(join(root, 'does-not-exist'));
    expectFolderError(join(root, 'notes.txt'));
    expectFolderError('app');
    expectFolderError('');
    expectFolderError(`${root}\0evil`);
  });

  it('refuses everything when no root exists any more', () => {
    expectFolderError(root, [join(base, 'gone')]);
  });

  it.runIf(isWindows)('is case-insensitive on Windows and returns the real casing', () => {
    expect(resolveAllowedPath(join(root, 'APP', 'Src'), roots)).toBe(join(root, 'app', 'src'));
    expect(resolveAllowedPath(join(root, 'app'), [root.toUpperCase()])).toBe(join(root, 'app'));
  });
});

describe('isInsideRoot / findRoot', () => {
  it.runIf(isWindows)('handles a drive root, which already ends in the separator', () => {
    expect(isInsideRoot('D:\\', 'D:\\')).toBe(true);
    expect(isInsideRoot('D:\\projetos\\api', 'D:\\')).toBe(true);
    expect(isInsideRoot('E:\\projetos', 'D:\\')).toBe(false);
  });

  it('finds the root that contains a path', () => {
    const other = join(base, 'outside');
    expect(findRoot(join(root, 'app'), [other, root])).toBe(root);
    expect(findRoot(join(base, 'root2'), [other, root])).toBeUndefined();
  });
});
