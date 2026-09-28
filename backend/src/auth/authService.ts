import { createHash, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

/** argon2.verify recomputes the hash and compares in constant time. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    // A malformed hash never authenticates.
    return false;
  }
}

/** Hashing both sides gives equal lengths, so timingSafeEqual never short-circuits on the length. */
export function usernameMatches(expected: string, given: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(given));
}

/**
 * Both checks always run — a wrong username still pays for argon2 — so the response time never
 * tells which of the two failed (ADR 0011).
 */
export async function verifyCredentials(
  auth: { username: string; passwordHash: string },
  credentials: { username: string; password: string },
): Promise<boolean> {
  const usernameOk = usernameMatches(auth.username, credentials.username);
  const passwordOk = await verifyPassword(auth.passwordHash, credentials.password);
  return usernameOk && passwordOk;
}
