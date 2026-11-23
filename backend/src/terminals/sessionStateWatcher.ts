import { type FSWatcher, mkdirSync, watch } from 'node:fs';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { SESSION_STATE_FILES } from './sessionState.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `terminalId` is lower case; `path` is the file below the terminal's folder, with `/` (`state.json`, `agents/x.stop.json`). */
export type SessionStateChange = { terminalId: string; path: string };
type Listener = (change: SessionStateChange) => void;

/**
 * One recursive `fs.watch` over DATA_DIR/session-state/, shared by everyone who reacts to the hook (ADR 0035's
 * deploy trigger, ADR 0038's events channel). Only changes inside a `<terminal uuid>/` folder are passed on; a
 * listener that throws never reaches the others. Never throws: a watcher error is only logged.
 */
export class SessionStateWatcher {
  private watcher: FSWatcher | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly stateDir: string;

  constructor(
    dataDir: string,
    private readonly log: Pick<FastifyBaseLogger, 'warn'>,
  ) {
    this.stateDir = join(dataDir, SESSION_STATE_FILES.dir);
  }

  /** Returns the unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.watcher) return;
    try {
      mkdirSync(this.stateDir, { recursive: true });
      this.watcher = watch(this.stateDir, { recursive: true }, (_event, filename) => {
        if (filename) this.emit(String(filename));
      });
      this.watcher.on('error', (error) => this.log.warn({ err: error }, 'session state: watcher error'));
    } catch (error) {
      this.log.warn({ err: error }, 'session state: could not watch the folder');
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private emit(filename: string): void {
    const [terminalId, ...rest] = filename.split(/[\\/]/);
    if (!terminalId || !UUID.test(terminalId) || rest.length === 0) return;
    const change = { terminalId: terminalId.toLowerCase(), path: rest.join('/') };
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        this.log.warn({ err: error }, 'session state: listener failed');
      }
    }
  }
}
