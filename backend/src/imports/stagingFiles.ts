import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { AppError } from '../common/errors.js';
import { MAX_IMPORT_FILES } from './imports.schemas.js';

/** All the files of one import together. A design handoff with screenshots fits; a whole repo does not. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Names Windows will not create (or turns into a device), and segments it silently trims. */
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

export type StagedFile = { path: string; data: Buffer };

/**
 * The folder a relative path lands in, inside `base` — or IMPORT_004. Checked per segment and then on the
 * resolved path, so nothing the client names can step out of the import's own `files/` folder.
 */
export function stagedPath(base: string, relativePath: string): string {
  const segments = relativePath.split('/');
  const valid = segments.every(
    (s) => s !== '' && s !== '.' && s !== '..' && !/[\\:\p{Cc}<>"|?*]/u.test(s) && !RESERVED.test(s) && !/[. ]$/.test(s),
  );
  if (!valid || relativePath.length > 512) throw new AppError('IMPORT_004');
  const root = resolve(base);
  const target = resolve(root, ...segments);
  if (!target.startsWith(root + sep)) throw new AppError('IMPORT_004');
  return target;
}

/**
 * Writes the uploaded files under `base` (created). Every path is checked and the limits enforced **before**
 * the first write, so a bad request leaves nothing behind. Never overwrites: two parts with the same path are
 * IMPORT_004 too (case-insensitive — Windows would merge them).
 */
export function writeStagedFiles(base: string, files: StagedFile[]): void {
  if (files.length === 0 || files.length > MAX_IMPORT_FILES) throw new AppError('IMPORT_004');
  const total = files.reduce((sum, file) => sum + file.data.length, 0);
  if (total > MAX_IMPORT_BYTES) throw new AppError('IMPORT_004');
  const targets = files.map((file) => stagedPath(base, file.path));
  if (new Set(targets.map((target) => target.toLowerCase())).size !== targets.length) throw new AppError('IMPORT_004');

  for (const [i, file] of files.entries()) {
    const target = targets[i]!;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.data, { flag: 'wx' });
  }
}

/** Where an import's uploaded files go. */
export function stagingDir(importDir: string): string {
  return join(importDir, 'files');
}
