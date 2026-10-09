export type ChallengeStoreOptions = {
  ttlMs?: number;
  /** Pending challenges kept; past this the oldest is dropped (the public options route is rate limited). */
  max?: number;
  now?: () => number;
};

type Pending = { owner: string; expiresAt: number };

/**
 * WebAuthn challenges the server has issued and not yet seen back (ADR 0015). Single use: `consume`
 * deletes it whether or not the rest of the ceremony succeeds. The login needs no cookie to bind it —
 * the challenge comes back inside the signed clientDataJSON; `owner` binds a registration to its session.
 */
export class ChallengeStore {
  private readonly pending = new Map<string, Pending>();
  private readonly ttlMs: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor({ ttlMs = 5 * 60_000, max = 100, now = Date.now }: ChallengeStoreOptions = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.now = now;
  }

  remember(challenge: string, owner: string): void {
    this.pending.delete(challenge);
    while (this.pending.size >= this.max) {
      const oldest = this.pending.keys().next().value;
      if (oldest === undefined) break;
      this.pending.delete(oldest);
    }
    this.pending.set(challenge, { owner, expiresAt: this.now() + this.ttlMs });
  }

  consume(challenge: string, owner: string): boolean {
    const entry = this.pending.get(challenge);
    if (!entry) return false;
    this.pending.delete(challenge);
    return entry.owner === owner && this.now() <= entry.expiresAt;
  }
}
