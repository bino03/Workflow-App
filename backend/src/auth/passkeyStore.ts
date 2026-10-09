import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from '../state/atomicWrite.js';

export const PASSKEYS_FILE_NAME = 'passkeys.json';
export const PASSKEYS_VERSION = 1;
export const MAX_PASSKEYS = 20;
export const MAX_PASSKEY_NAME = 64;

const base64url = z.string().min(1).max(2048).regex(/^[A-Za-z0-9_-]+$/, 'must be base64url');
const instant = z.iso.datetime();

export const storedPasskeySchema = z.object({
  /** The credential id, as the browser sends it back on login. */
  id: base64url,
  publicKey: base64url,
  counter: z.number().int().min(0),
  transports: z.array(z.string().max(32)).max(10).default([]),
  name: z.string().min(1).max(MAX_PASSKEY_NAME),
  deviceType: z.enum(['singleDevice', 'multiDevice']),
  backedUp: z.boolean(),
  createdAt: instant,
  lastUsedAt: instant.nullable(),
});

const passkeysFileSchema = z
  .object({
    version: z.literal(PASSKEYS_VERSION),
    passkeys: z.array(storedPasskeySchema).max(MAX_PASSKEYS),
  })
  .refine((file) => new Set(file.passkeys.map((passkey) => passkey.id)).size === file.passkeys.length, {
    message: 'passkey ids must be unique',
    path: ['passkeys'],
  });

export type StoredPasskey = z.infer<typeof storedPasskeySchema>;

/** `passkeys.json` exists but cannot be used. The backend refuses to start — the file is never overwritten. */
export class PasskeyFileError extends Error {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`Invalid ${file} (fix or move it away; it is never overwritten):\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'PasskeyFileError';
  }
}

export type PasskeyStoreOptions = {
  /** Injected in tests to simulate a failing disk. */
  write?: (file: string, data: string) => Promise<void>;
};

/**
 * The single owner of `DATA_DIR/passkeys.json` (ADR 0015) — public keys only, apart from state.json
 * (credentials never mix with terminal state, ADR 0011). Unlike the StateStore, a change is only
 * committed in memory once it is on disk: a passkey that would vanish on restart must fail now.
 */
export class PasskeyStore {
  private passkeys: StoredPasskey[];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly write: (file: string, data: string) => Promise<void>;

  private constructor(
    readonly file: string,
    passkeys: StoredPasskey[],
    { write = atomicWrite }: PasskeyStoreOptions,
  ) {
    this.passkeys = passkeys;
    this.write = write;
  }

  /** Missing file → no passkeys (nothing is written until the first one). Invalid → PasskeyFileError. */
  static async load(dataDir: string, options: PasskeyStoreOptions = {}): Promise<PasskeyStore> {
    await mkdir(dataDir, { recursive: true });
    const file = join(dataDir, PASSKEYS_FILE_NAME);

    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new PasskeyStore(file, [], options);
      throw error;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new PasskeyFileError(file, [(error as Error).message]);
    }
    const parsed = passkeysFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new PasskeyFileError(
        file,
        parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
      );
    }
    return new PasskeyStore(file, parsed.data.passkeys, options);
  }

  list(): StoredPasskey[] {
    return structuredClone(this.passkeys);
  }

  find(id: string): StoredPasskey | undefined {
    const passkey = this.passkeys.find((candidate) => candidate.id === id);
    return passkey && structuredClone(passkey);
  }

  get count(): number {
    return this.passkeys.length;
  }

  /** Throws (and changes nothing) if the result is invalid: a duplicate id or more than MAX_PASSKEYS. */
  add(passkey: StoredPasskey): Promise<void> {
    return this.mutate((passkeys) => [...passkeys, passkey]);
  }

  /** Resolves to false if there was no such passkey. */
  async remove(id: string): Promise<boolean> {
    let found = false;
    await this.mutate((passkeys) => {
      found = passkeys.some((passkey) => passkey.id === id);
      return passkeys.filter((passkey) => passkey.id !== id);
    });
    return found;
  }

  recordUse(id: string, counter: number, at: string): Promise<void> {
    return this.mutate((passkeys) =>
      passkeys.map((passkey) => (passkey.id === id ? { ...passkey, counter, lastUsedAt: at } : passkey)),
    );
  }

  /** One change at a time, each computed from the last committed list, validated, written, then committed. */
  private mutate(recipe: (passkeys: StoredPasskey[]) => StoredPasskey[]): Promise<void> {
    const run = this.queue.then(async () => {
      const next = passkeysFileSchema.parse({ version: PASSKEYS_VERSION, passkeys: recipe(structuredClone(this.passkeys)) });
      await this.write(this.file, `${JSON.stringify(next, null, 2)}\n`);
      this.passkeys = next.passkeys;
    });
    // A failed change must not block the next one.
    this.queue = run.catch(() => {});
    return run;
  }
}
