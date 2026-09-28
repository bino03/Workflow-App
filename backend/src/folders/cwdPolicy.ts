import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, sep } from 'node:path';
import { AppError } from '../common/errors.js';

// Windows paths are case-insensitive: C:\Dev and c:\dev are the same folder.
const comparable = (path: string) => (process.platform === 'win32' ? path.toLowerCase() : path);

/** `path` is `root` itself or somewhere below it. Both must already be real paths. */
export function isInsideRoot(path: string, root: string): boolean {
  const target = comparable(path);
  const base = comparable(root);
  if (target === base) return true;
  // A drive root (D:\) already ends in the separator; any other root needs one, or C:\dev2 would pass as C:\dev.
  const prefix = base.endsWith(sep) ? base : base + sep;
  return target.startsWith(prefix);
}

/** The root that contains `path`, or undefined. */
export function findRoot(path: string, roots: readonly string[]): string | undefined {
  return roots.find((root) => isInsideRoot(path, root));
}

function realDirectory(path: string): string | undefined {
  try {
    // native: resolves junctions and symlinks, and returns the real casing.
    const real = realpathSync.native(path);
    return statSync(real).isDirectory() ? real : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The only way a folder chosen by the client becomes a cwd (ADR 0004, protection 5): absolute, existing,
 * a directory, and — after resolving `..`, symlinks and junctions — inside one of ALLOWED_ROOTS.
 * Anything else is FOLDER_001, without saying which check failed.
 */
export function resolveAllowedPath(input: string, roots: readonly string[]): string {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0') || !isAbsolute(input)) {
    throw new AppError('FOLDER_001');
  }
  const real = realDirectory(input);
  const realRoots = roots.map((root) => realDirectory(root)).filter((root): root is string => root !== undefined);
  if (!real || !findRoot(real, realRoots)) throw new AppError('FOLDER_001');
  return real;
}
