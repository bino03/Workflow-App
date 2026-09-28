import { open, rename as fsRename } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

/** Codes Windows returns while an antivirus or the indexer holds the target file open. */
const TRANSIENT_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

export type AtomicWriteOptions = {
  /** Injected in tests to simulate a locked file. */
  rename?: (from: string, to: string) => Promise<void>;
  retries?: number;
  baseDelayMs?: number;
};

/**
 * Writes `<file>.tmp` (flushed to disk) and renames it over `file`, so a crash never leaves a
 * half-written file. The rename is retried with exponential backoff on transient Windows errors.
 */
export async function atomicWrite(
  file: string,
  data: string,
  { rename = fsRename, retries = 6, baseDelayMs = 20 }: AtomicWriteOptions = {},
): Promise<void> {
  const tmp = `${file}.tmp`;
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(data, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= retries || !code || !TRANSIENT_CODES.has(code)) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}
