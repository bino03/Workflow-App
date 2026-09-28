import { randomBytes } from 'node:crypto';

export type Session = {
  id: string;
  createdAt: number;
  lastSeenAt: number;
};

type Entry = Session & { onEnd: Set<() => void> };

export type SessionStoreOptions = {
  idleMs: number;
  maxMs: number;
  now?: () => number;
  sweepIntervalMs?: number;
};

/**
 * Server-side sessions, in memory (ADR 0003): restarting the backend logs everyone out.
 * A session ends after `idleMs` without requests or `maxMs` after login, whichever comes first;
 * ending it runs the registered callbacks (used to close that session's WebSockets).
 */
export class SessionStore {
  private readonly sessions = new Map<string, Entry>();
  private readonly now: () => number;
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly options: SessionStoreOptions) {
    this.now = options.now ?? Date.now;
    this.sweeper = setInterval(() => this.sweep(), options.sweepIntervalMs ?? 60_000);
    this.sweeper.unref();
  }

  create(): Session {
    const at = this.now();
    const entry: Entry = { id: randomBytes(32).toString('base64url'), createdAt: at, lastSeenAt: at, onEnd: new Set() };
    this.sessions.set(entry.id, entry);
    return toSession(entry);
  }

  /** Returns the live session and refreshes its idle timer; ends it if it has expired. */
  touch(id: string): Session | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.destroy(id);
      return undefined;
    }
    entry.lastSeenAt = this.now();
    return toSession(entry);
  }

  /** Registers a callback for when the session ends (logout or expiry). Returns an unsubscribe function. */
  onEnd(id: string, callback: () => void): () => void {
    const entry = this.sessions.get(id);
    if (!entry) {
      callback();
      return () => {};
    }
    entry.onEnd.add(callback);
    return () => entry.onEnd.delete(callback);
  }

  destroy(id: string): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    this.sessions.delete(id);
    for (const callback of entry.onEnd) callback();
  }

  sweep(): void {
    for (const entry of [...this.sessions.values()]) {
      if (this.isExpired(entry)) this.destroy(entry.id);
    }
  }

  close(): void {
    clearInterval(this.sweeper);
    for (const id of [...this.sessions.keys()]) this.destroy(id);
  }

  private isExpired(entry: Entry): boolean {
    const at = this.now();
    return at - entry.lastSeenAt > this.options.idleMs || at - entry.createdAt > this.options.maxMs;
  }
}

function toSession({ id, createdAt, lastSeenAt }: Entry): Session {
  return { id, createdAt, lastSeenAt };
}
