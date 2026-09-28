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
