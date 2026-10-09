import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ChallengeStore } from '../src/auth/challengeStore.js';
import { MAX_PASSKEYS, PASSKEYS_FILE_NAME, PasskeyFileError, PasskeyStore, type StoredPasskey } from '../src/auth/passkeyStore.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';
import { SoftAuthenticator } from './softAuthenticator.js';

const PASSWORD = 'correct horse battery staple';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

function noTerminals() {
  return new TerminalManager({
    spawn: () => {
      throw new Error('no spawn in passkey tests');
    },
    maxTerminals: 1,
    scrollbackBytes: 1024,
  });
}

function storedPasskey(id: string): StoredPasskey {
  return {
    id,
    publicKey: 'AAAA',
    counter: 0,
    transports: [],
    name: id,
    deviceType: 'singleDevice',
    backedUp: false,
    createdAt: '2026-10-09T10:00:00.000Z',
    lastUsedAt: null,
  };
}

describe('passkeys (ADR 0015)', () => {
  let app: FastifyInstance;
  let dataDir: string;

  async function start() {
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash, DATA_DIR: dataDir });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager: noTerminals(), logger: false });
    await app.ready();
  }

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'wfa-passkey-test-'));
    await start();
  });

  afterEach(async () => {
    await app.close();
  });

  function cookieOf(res: LightMyRequestResponse): string {
    const cookie = res.cookies.find((c) => c.name === 'session');
    if (!cookie) throw new Error(`no session cookie (status ${res.statusCode}: ${res.body})`);
    return `session=${cookie.value}`;
  }

  async function passwordLogin(): Promise<string> {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    return cookieOf(res);
  }

  async function registrationOptions(cookie: string, password = PASSWORD) {
    return app.inject({ method: 'POST', url: '/api/auth/passkeys/registration/options', payload: { password }, headers: { cookie } });
  }

  async function register(cookie: string, authenticator: SoftAuthenticator, name = 'iPhone') {
    const options = (await registrationOptions(cookie)).json();
    return app.inject({
      method: 'POST',
      url: '/api/auth/passkeys',
      payload: { name, response: authenticator.register(options) },
      headers: { cookie },
    });
  }

  async function loginOptions() {
    return (await app.inject({ method: 'POST', url: '/api/auth/passkeys/login/options' })).json();
  }

  async function passkeyLogin(response: unknown) {
    return app.inject({ method: 'POST', url: '/api/auth/passkeys/login', payload: { response } });
  }

  async function me(cookie: string) {
    return (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode;
  }

  describe('registration', () => {
    it('asks for the password again, then stores the public key on disk', async () => {
      const cookie = await passwordLogin();
      const optionsRes = await registrationOptions(cookie);
      expect(optionsRes.statusCode).toBe(200);
      const options = optionsRes.json();
      expect(options.rp).toEqual({ name: 'Workflow App', id: 'localhost' });
      expect(options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' });

      const authenticator = new SoftAuthenticator();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/passkeys',
        payload: { name: 'iPhone', response: authenticator.register(options) },
        headers: { cookie },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ id: authenticator.id, name: 'iPhone', lastUsedAt: null, current: false });

      const file = JSON.parse(readFileSync(join(dataDir, PASSKEYS_FILE_NAME), 'utf8'));
      expect(file.version).toBe(1);
      expect(file.passkeys).toHaveLength(1);
      expect(file.passkeys[0].id).toBe(authenticator.id);
      expect(file.passkeys[0].publicKey.length).toBeGreaterThan(50);
    });

    it('wrong password → 403 AUTH_006 (not 401: the session is still good)', async () => {
      const cookie = await passwordLogin();
      const res = await registrationOptions(cookie, 'wrong password!!');
      expect(res.statusCode).toBe(403);
      expect(res.json().errorCode).toBe('AUTH_006');
      expect(await me(cookie)).toBe(200);
    });

    it('needs a session: every registration and management route → 401 without one', async () => {
      for (const [method, url] of [
        ['POST', '/api/auth/passkeys/registration/options'],
        ['POST', '/api/auth/passkeys'],
        ['GET', '/api/auth/passkeys'],
        ['DELETE', '/api/auth/passkeys/abc'],
      ] as const) {
        const res = await app.inject({ method, url, payload: method === 'POST' ? {} : undefined });
        expect(res.statusCode, `${method} ${url}`).toBe(401);
        expect(res.json().errorCode).toBe('AUTH_002');
      }
    });

    it('a challenge issued to one session cannot finish a registration in another', async () => {
      const first = await passwordLogin();
      const options = (await registrationOptions(first)).json();
      // A second browser: logging in here does not end the first session.
      const second = await passwordLogin();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/passkeys',
        payload: { name: 'x', response: new SoftAuthenticator().register(options) },
        headers: { cookie: second },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().errorCode).toBe('AUTH_008');
    });

    it('a response from another origin or rpID is refused', async () => {
      const cookie = await passwordLogin();
      for (const overrides of [{ origin: 'https://evil.example' }, { rpId: 'evil.example' }, { userVerified: false }]) {
        const options = (await registrationOptions(cookie)).json();
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/passkeys',
          payload: { name: 'x', response: new SoftAuthenticator().register(options, overrides) },
          headers: { cookie },
        });
        expect(res.json().errorCode, JSON.stringify(overrides)).toBe('AUTH_008');
      }
    });

    it(`refuses more than ${MAX_PASSKEYS} passkeys → 409 AUTH_007`, async () => {
      await app.close();
      const full = Array.from({ length: MAX_PASSKEYS }, (_, i) => storedPasskey(`key${i}`));
      writeFileSync(join(dataDir, PASSKEYS_FILE_NAME), JSON.stringify({ version: 1, passkeys: full }));
      await start();
      const res = await registrationOptions(await passwordLogin());
      expect(res.statusCode).toBe(409);
      expect(res.json().errorCode).toBe('AUTH_007');
    });
  });

  describe('login', () => {
    let authenticator: SoftAuthenticator;

    beforeEach(async () => {
      authenticator = new SoftAuthenticator();
      expect((await register(await passwordLogin(), authenticator)).statusCode).toBe(201);
    });

    it('options are public; the passkey opens the same session as the password', async () => {
      const options = await loginOptions();
      expect(options.rpId).toBe('localhost');
      expect(options.userVerification).toBe('required');
      expect(options.allowCredentials ?? []).toEqual([]); // discoverable

      const res = await passkeyLogin(authenticator.authenticate(options));
      expect(res.statusCode).toBe(204);
      const cookie = res.cookies.find((c) => c.name === 'session')!;
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe('Strict');
      expect(cookie.maxAge).toBe(7 * 24 * 60 * 60);
      expect(await me(cookieOf(res))).toBe(200);

      const list = (await app.inject({ method: 'GET', url: '/api/auth/passkeys', headers: { cookie: cookieOf(res) } })).json();
      expect(list.passkeys).toHaveLength(1);
      expect(list.passkeys[0]).toMatchObject({ id: authenticator.id, current: true });
      expect(list.passkeys[0].lastUsedAt).not.toBeNull();
      const onDisk = JSON.parse(readFileSync(join(dataDir, PASSKEYS_FILE_NAME), 'utf8')).passkeys[0];
      expect(onDisk.counter).toBe(1);
    });

    it('a replayed response (same challenge) → 401 AUTH_005', async () => {
      const response = authenticator.authenticate(await loginOptions());
      expect((await passkeyLogin(response)).statusCode).toBe(204);
      const replay = await passkeyLogin(response);
      expect(replay.statusCode).toBe(401);
      expect(replay.json().errorCode).toBe('AUTH_005');
    });

    // Split in two: the beforeEach's password login already spent one of the 5 attempts per minute.
    it.each([
      ['unknown passkey, forged signature, foreign origin', [
        () => new SoftAuthenticator(),
        { forgeSignature: true },
        { origin: 'https://evil.example' },
      ]],
      ['127.0.0.1 (never under the rpID), invented challenge', [{ origin: 'http://127.0.0.1:7401' }, 'invented']],
    ] as const)('%s → the same AUTH_005, no cookie', async (_title, variants) => {
      const cases = [];
      for (const variant of variants) {
        if (typeof variant === 'function') cases.push(variant().authenticate(await loginOptions()));
        else if (variant === 'invented') cases.push(authenticator.authenticate({ challenge: 'bm90LWlzc3VlZA' }));
        else cases.push(authenticator.authenticate(await loginOptions(), variant));
      }
      for (const [index, response] of cases.entries()) {
        const res = await passkeyLogin(response);
        expect(res.statusCode, `case ${index}`).toBe(401);
        expect(res.json()).toEqual({ errorCode: 'AUTH_005', message: 'Passkey not accepted' });
        expect(res.cookies).toHaveLength(0);
      }
    });

    it('a malformed body → 400 COMMON_001', async () => {
      const res = await passkeyLogin({ id: 'not base64url!' });
      expect(res.statusCode).toBe(400);
      expect(res.json().errorCode).toBe('COMMON_001');
    });
  });

  describe('rate limit, shared with the password login', () => {
    it('5 identity attempts per minute across the password, the passkey and the registration password', async () => {
      // The beforeEach-free path: a fresh app, so the counter starts at zero for this IP.
      const cookie = await passwordLogin(); // 1
      expect((await registrationOptions(cookie, 'wrong password!!')).statusCode).toBe(403); // 2
      expect((await passkeyLogin(new SoftAuthenticator().authenticate(await loginOptions()))).statusCode).toBe(401); // 3
      expect((await passkeyLogin(new SoftAuthenticator().authenticate(await loginOptions()))).statusCode).toBe(401); // 4
      expect((await registrationOptions(cookie)).statusCode).toBe(200); // 5

      const limited = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
      expect(limited.statusCode).toBe(429);
      expect(limited.json().errorCode).toBe('AUTH_004');
      const limitedPasskey = await passkeyLogin(new SoftAuthenticator().authenticate(await loginOptions()));
      expect(limitedPasskey.statusCode).toBe(429);
    });

    it('the options route has its own, looser limit (it proves nothing)', async () => {
      for (let i = 0; i < 10; i++) {
        expect((await app.inject({ method: 'POST', url: '/api/auth/passkeys/login/options' })).statusCode).toBe(200);
      }
    });
  });

  describe('revocation', () => {
    it('removes the passkey and ends the sessions opened with it, not the others', async () => {
      const passwordSession = await passwordLogin();
      const authenticator = new SoftAuthenticator();
      expect((await register(passwordSession, authenticator)).statusCode).toBe(201);
      const phoneSession = cookieOf(await passkeyLogin(authenticator.authenticate(await loginOptions())));
      expect(await me(phoneSession)).toBe(200);

      const res = await app.inject({ method: 'DELETE', url: `/api/auth/passkeys/${authenticator.id}`, headers: { cookie: passwordSession } });
      expect(res.statusCode).toBe(204);
      expect(await me(phoneSession)).toBe(401);
      expect(await me(passwordSession)).toBe(200);

      const list = (await app.inject({ method: 'GET', url: '/api/auth/passkeys', headers: { cookie: passwordSession } })).json();
      expect(list.passkeys).toEqual([]);
      // And it cannot log in any more.
      const again = await passkeyLogin(authenticator.authenticate(await loginOptions()));
      expect(again.json().errorCode).toBe('AUTH_005');
    });

    it('an unknown id → 404 AUTH_009', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/auth/passkeys/nope', headers: { cookie: await passwordLogin() } });
      expect(res.statusCode).toBe(404);
      expect(res.json().errorCode).toBe('AUTH_009');
    });
  });

  it('survives a restart: passkeys are read back from passkeys.json', async () => {
    const authenticator = new SoftAuthenticator();
    expect((await register(await passwordLogin(), authenticator)).statusCode).toBe(201);
    await app.close();
    await start();
    expect((await passkeyLogin(authenticator.authenticate(await loginOptions()))).statusCode).toBe(204);
  });
});

describe('PasskeyStore', () => {
  it('an invalid file → PasskeyFileError, never overwritten', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wfa-passkey-store-'));
    writeFileSync(join(dir, PASSKEYS_FILE_NAME), '{"version": 1, "passkeys": [{"id": 1}]}');
    await expect(PasskeyStore.load(dir)).rejects.toBeInstanceOf(PasskeyFileError);
    expect(readFileSync(join(dir, PASSKEYS_FILE_NAME), 'utf8')).toContain('"id": 1');
  });

  it('a failed write commits nothing, and does not block the next change', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wfa-passkey-store-'));
    let fail = true;
    const store = await PasskeyStore.load(dir, {
      write: async () => {
        if (fail) throw new Error('disk full');
      },
    });
    await expect(store.add(storedPasskey('a'))).rejects.toThrow('disk full');
    expect(store.list()).toEqual([]);
    fail = false;
    await store.add(storedPasskey('b'));
    expect(store.list().map((p) => p.id)).toEqual(['b']);
  });

  it('refuses a duplicate id', async () => {
    const store = await PasskeyStore.load(mkdtempSync(join(tmpdir(), 'wfa-passkey-store-')));
    await store.add(storedPasskey('a'));
    await expect(store.add(storedPasskey('a'))).rejects.toThrow();
    expect(store.count).toBe(1);
  });
});

describe('ChallengeStore', () => {
  it('single use, bound to its owner, expires', () => {
    let clock = 0;
    const store = new ChallengeStore({ ttlMs: 1000, now: () => clock });
    store.remember('a', 'login');
    expect(store.consume('a', 'login')).toBe(true);
    expect(store.consume('a', 'login')).toBe(false);

    store.remember('b', 'session-1');
    expect(store.consume('b', 'session-2')).toBe(false);

    store.remember('c', 'login');
    clock = 1001;
    expect(store.consume('c', 'login')).toBe(false);
  });

  it('keeps at most `max` pending, dropping the oldest', () => {
    const store = new ChallengeStore({ max: 2 });
    store.remember('a', 'login');
    store.remember('b', 'login');
    store.remember('c', 'login');
    expect(store.consume('a', 'login')).toBe(false);
    expect(store.consume('b', 'login')).toBe(true);
    expect(store.consume('c', 'login')).toBe(true);
  });
});
