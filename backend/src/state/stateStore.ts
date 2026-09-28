import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './atomicWrite.js';
import { type AppState, emptyState, enforceLimits, migrate, stateSchema } from './state.schema.js';

export const STATE_FILE_NAME = 'state.json';

/** `state.json` exists but cannot be used. The backend refuses to start — the file is never overwritten. */
export class StateFileError extends Error {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`Invalid ${file} (fix or move it away; it is never overwritten):\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'StateFileError';
  }
}

export type StateLogger = { error: (details: object, message: string) => void };

export type StateStoreOptions = {
  /** Injected in tests to simulate a failing disk. */
  write?: (file: string, data: string) => Promise<void>;
};

const consoleLogger: StateLogger = {
  error: (details, message) => console.error(message, details),
};

/**
 * The single owner of `DATA_DIR/state.json` (ADR 0009). Reads it once at startup; every change goes
 * through `update`, which validates, applies the limits and queues one write at a time.
 */
export class StateStore {
  /** Replaced by the app's logger once Fastify exists. */
  logger: StateLogger = consoleLogger;

  private state: AppState;
  private writing = false;
  private dirty = false;
  private pending: Promise<void> = Promise.resolve();
  private readonly write: (file: string, data: string) => Promise<void>;

  private constructor(
    readonly file: string,
    state: AppState,
    { write = atomicWrite }: StateStoreOptions,
  ) {
    this.state = state;
    this.write = write;
  }

  /** Missing file → empty state (nothing is written until the first change). Invalid → StateFileError. */
  static async load(dataDir: string, options: StateStoreOptions = {}): Promise<StateStore> {
    await mkdir(dataDir, { recursive: true });
    const file = join(dataDir, STATE_FILE_NAME);

    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new StateStore(file, emptyState(), options);
      throw error;
    }

    let raw: unknown;
    try {
      raw = migrate(JSON.parse(text));
    } catch (error) {
      throw new StateFileError(file, [(error as Error).message]);
    }

    const parsed = stateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new StateFileError(
        file,
        parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
      );
    }
    return new StateStore(file, enforceLimits(parsed.data), options);
  }

  /** A copy — the store's state is only changed through `update`. */
  read(): AppState {
    return structuredClone(this.state);
  }

  /**
   * Applies `recipe` to a copy, validates it and enforces the limits, then commits it in memory and
   * queues the write. An invalid result throws and changes nothing.
   */
  update(recipe: (draft: AppState) => void): AppState {
    const draft = structuredClone(this.state);
    recipe(draft);
    this.state = enforceLimits(stateSchema.parse(draft));
    this.scheduleWrite();
    return structuredClone(this.state);
  }

  /** Resolves once every change made so far has been written (or has failed and been logged). */
  flush(): Promise<void> {
    return this.pending;
  }

  private scheduleWrite(): void {
    this.dirty = true;
    if (this.writing) return; // the running drain picks up the newest state
    this.writing = true;
    this.pending = this.drain();
  }

  private async drain(): Promise<void> {
    while (this.dirty) {
      this.dirty = false;
      const data = `${JSON.stringify(this.state, null, 2)}\n`;
      try {
        await this.write(this.file, data);
      } catch (error) {
        // Decided: keep the state in memory and try again on the next change.
        this.logger.error({ err: error, file: this.file }, 'could not write state.json; the change stays in memory until the next write');
      }
    }
    this.writing = false;
  }
}
