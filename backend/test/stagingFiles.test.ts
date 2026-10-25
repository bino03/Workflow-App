import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors.js';
import { MAX_IMPORT_BYTES, stagedPath, writeStagedFiles } from '../src/imports/stagingFiles.js';

let base: string;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'wfa-staging-'));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

const file = (path: string, text = 'x') => ({ path, data: Buffer.from(text) });

function expectImport004(action: () => unknown) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe('IMPORT_004');
}

describe('stagedPath', () => {
  it('keeps a folder upload inside the base', () => {
    expect(stagedPath(base, 'handoff/README.md')).toBe(join(base, 'handoff', 'README.md'));
    expect(stagedPath(base, 'skill-x.md')).toBe(join(base, 'skill-x.md'));
  });

  it('refuses anything that could step out, or that Windows would not keep as named', () => {
    for (const path of [
      '../x.md',
      'a/../../x.md',
      'a/./x.md',
      '/etc/passwd',
      'C:/Windows/x',
      'a\\..\\x',
      'a//x',
      '',
      'con',
      'NUL.txt',
      'a/lpt1',
      'trailing.',
      'trailing ',
      'a:stream',
      'x\u0000y',
      'what?.md',
      'a'.repeat(513),
    ]) {
      expectImport004(() => stagedPath(base, path));
    }
  });
});

describe('writeStagedFiles', () => {
  it('writes every file with its folders', () => {
    writeStagedFiles(join(base, 'files'), [file('handoff/README.md', '# hi'), file('handoff/css/tokens.css', ':root{}')]);
    expect(readFileSync(join(base, 'files', 'handoff', 'README.md'), 'utf8')).toBe('# hi');
    expect(readFileSync(join(base, 'files', 'handoff', 'css', 'tokens.css'), 'utf8')).toBe(':root{}');
  });

  it('checks everything before the first write: one bad path, a duplicate (any case) or too many bytes → nothing written', () => {
    const target = join(base, 'files');
    for (const files of [
      [file('ok.md'), file('../bad.md')],
      [file('a/X.md'), file('a/x.md')],
      [file('big.bin', ''), { path: 'huge.bin', data: Buffer.alloc(MAX_IMPORT_BYTES + 1) }],
      [],
      Array.from({ length: 201 }, (_, i) => file(`f${i}.md`)),
    ]) {
      expectImport004(() => writeStagedFiles(target, files));
      expect(existsSync(target) ? readdirSync(target) : []).toEqual([]);
    }
  });
});
