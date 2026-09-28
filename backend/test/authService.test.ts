import argon2 from 'argon2';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { usernameMatches, verifyCredentials } from '../src/auth/authService.js';

const PASSWORD = 'correct horse battery staple';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usernameMatches', () => {
  it('is an exact, case-sensitive comparison', () => {
    expect(usernameMatches('bino03', 'bino03')).toBe(true);
    expect(usernameMatches('bino03', 'Bino03')).toBe(false);
    expect(usernameMatches('bino03', 'bino0')).toBe(false);
    expect(usernameMatches('bino03', 'bino03-and-a-much-longer-tail')).toBe(false);
  });
});

describe('verifyCredentials', () => {
  const auth = () => ({ username: 'bino03', passwordHash });

  it('accepts only both right', async () => {
    expect(await verifyCredentials(auth(), { username: 'bino03', password: PASSWORD })).toBe(true);
    expect(await verifyCredentials(auth(), { username: 'bino03', password: 'nope' })).toBe(false);
    expect(await verifyCredentials(auth(), { username: 'other', password: PASSWORD })).toBe(false);
  });

  it('still runs argon2 when the username is wrong (no timing shortcut)', async () => {
    const verify = vi.spyOn(argon2, 'verify');
    expect(await verifyCredentials(auth(), { username: 'other', password: PASSWORD })).toBe(false);
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
