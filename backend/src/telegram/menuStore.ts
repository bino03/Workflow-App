import { randomBytes } from 'node:crypto';

/**
 * What a bot button means, kept in memory: Telegram's `callback_data` carries only a short random key
 * (≤ 64 bytes, and anything in it comes back from the client). Keys expire, and every action is checked
 * again when it runs (ADR 0017) — a key only says what was offered, never that it is still allowed.
 */
export class MenuStore<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 500,
  ) {}

  put(value: T): string {
    this.prune();
    const key = randomBytes(6).toString('base64url'); // 8 characters
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    return key;
  }

  /** The value, or undefined when the key is unknown or expired. A button can be pressed more than once. */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key);
    // Oldest first (Map keeps insertion order): a burst of menus never grows memory without bound.
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }
}
