import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { SessionStore } from '../src/auth/sessionStore.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_ORIGIN, TEST_USERNAME, testConfig } from './helpers.js';

const PASSWORD = 'correct horse battery staple';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

function noTerminals() {
  return new TerminalManager({
    spawn: () => {
      throw new Error('no spawn in auth tests');
    },
    maxTerminals: 1,
    scrollbackBytes: 1024,
  });
}

describe('auth', () => {
  let app: FastifyInstance;
  let clock: number;
  let sessionStore: SessionStore;

  beforeEach(async () => {
    clock = 1_000_000;
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash });
    sessionStore = new SessionStore({
      idleMs: config.auth.sessionIdleMs,
      maxMs: config.auth.sessionMaxMs,
      now: () => clock,
    });
    app = await buildApp({ config, terminalManager: noTerminals(), sessionStore, logger: false });
    app.get('/test/ws', { websocket: true }, (socket) => socket.on('message', (data) => socket.send(`echo:${data.toString()}`)));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function login(password = PASSWORD, cookie?: string, username = TEST_USERNAME) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password },
      headers: cookie ? { cookie } : {},
    });
  }

  function sessionCookie(res: Awaited<ReturnType<typeof login>>): string {
    const cookie = res.cookies.find((c) => c.name === 'session');
    if (!cookie) throw new Error('no session cookie');
    return `session=${cookie.value}`;
  }

  it('login → 204 with an HttpOnly, SameSite=Strict, signed cookie', async () => {
    const res = await login();
    expect(res.statusCode).toBe(204);
    const cookie = res.cookies.find((c) => c.name === 'session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(cookie.path).toBe('/');
    expect(cookie.maxAge).toBe(7 * 24 * 60 * 60);
    expect(cookie.value).toContain('.'); // signed: <id>.<signature>
  });

  it('wrong password → 401 AUTH_001, no cookie', async () => {
    const res = await login('wrong password!!');
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_001');
    expect(res.cookies).toHaveLength(0);
  });

  it('wrong username → the same 401 AUTH_001, no cookie', async () => {
    // 4 attempts: under the 5/min rate limit.
    const wrongPassword = (await login('wrong password!!')).json();
    for (const username of ['someone-else', TEST_USERNAME.toUpperCase(), `${TEST_USERNAME}x`]) {
      const res = await login(PASSWORD, undefined, username);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual(wrongPassword);
      expect(res.cookies).toHaveLength(0);
    }
  });

  it('surrounding spaces in the username are ignored', async () => {
    expect((await login(PASSWORD, undefined, `  ${TEST_USERNAME} `)).statusCode).toBe(204);
  });

  it('empty body → 400 COMMON_001 with fieldErrors for both fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().fieldErrors.map((e: { field: string }) => e.field).sort()).toEqual(['password', 'username']);
  });

  it('me requires a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).json().errorCode).toBe('AUTH_002');
    const cookie = sessionCookie(await login());
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ authenticated: true });
  });

  it('unknown route with a session → 404 COMMON_003', async () => {
    const cookie = sessionCookie(await login());
    const res = await app.inject({ method: 'GET', url: '/api/nope', headers: { cookie } });
    expect(res.statusCode).toBe(404);
    expect(res.json().errorCode).toBe('COMMON_003');
  });

  it('a tampered cookie is rejected', async () => {
    const cookie = sessionCookie(await login());
    const tampered = cookie.replace(/session=./, (m) => (m.endsWith('A') ? 'session=B' : 'session=A'));
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: tampered } });
    expect(res.statusCode).toBe(401);
  });

  it('logout ends the session server-side and clears the cookie', async () => {
    const cookie = sessionCookie(await login());
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(res.statusCode).toBe(204);
    const cleared = res.cookies.find((c) => c.name === 'session')!;
    expect(cleared.value).toBe('');
    expect(cleared.httpOnly).toBe(true);
    expect(cleared.sameSite).toBe('Strict');
    // The old cookie no longer works, even if the browser kept it.
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('logging in again replaces the previous session', async () => {
    const first = sessionCookie(await login());
    const second = sessionCookie(await login(PASSWORD, first));
    expect(second).not.toBe(first);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: first } })).statusCode).toBe(401);
  });

  it('expires after 12 h idle, and after 7 days even when active', async () => {
    const cookie = sessionCookie(await login());
    const me = () => app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });

    clock += 11 * 60 * 60 * 1000;
    expect((await me()).statusCode).toBe(200); // activity refreshes the idle timer
    clock += 11 * 60 * 60 * 1000;
    expect((await me()).statusCode).toBe(200);
    clock += 13 * 60 * 60 * 1000;
    expect((await me()).statusCode).toBe(401);

    const active = sessionCookie(await login());
    for (let day = 0; day < 7; day++) {
      clock += 10 * 60 * 60 * 1000;
      await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: active } });
    }
    clock += 30 * 60 * 60 * 1000;
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: active } });
    expect(res.statusCode).toBe(401);
  });

  it('ending a session runs its onEnd callbacks (to close its WebSockets)', async () => {
    const res = await login();
    const id = res.cookies.find((c) => c.name === 'session')!.value.split('.')[0]!;
    let ended = 0;
    sessionStore.onEnd(id, () => ended++);
    clock += 13 * 60 * 60 * 1000;
    sessionStore.sweep();
    expect(ended).toBe(1);
  });

  it('login is rate limited to 5 per minute per IP → 429 AUTH_004', async () => {
    for (let i = 0; i < 5; i++) expect((await login('wrong password!!')).statusCode).toBe(401);
    const res = await login();
    expect(res.statusCode).toBe(429);
    expect(res.json().errorCode).toBe('AUTH_004');
  });

  describe('WebSocket upgrade (ADR 0004 security tests)', () => {
    it('without a cookie → refused', async () => {
      await expect(app.injectWS('/test/ws', { headers: { origin: TEST_ORIGIN } })).rejects.toThrow(/401/);
    });

    it('with a cookie but a foreign Origin → refused', async () => {
      const cookie = sessionCookie(await login());
      await expect(app.injectWS('/test/ws', { headers: { cookie, origin: 'https://evil.example' } })).rejects.toThrow(/403/);
    });

    it('with a cookie and no Origin → refused', async () => {
      const cookie = sessionCookie(await login());
      await expect(app.injectWS('/test/ws', { headers: { cookie } })).rejects.toThrow(/403/);
    });

    it('with a cookie and an allowed Origin → connects', async () => {
      const cookie = sessionCookie(await login());
      const ws = await app.injectWS('/test/ws', { headers: { cookie, origin: TEST_ORIGIN } });
      const message = new Promise<string>((resolve) => ws.once('message', (data) => resolve(data.toString())));
      ws.send('ping');
      expect(await message).toBe('echo:ping');
      ws.terminate();
    });
  });
});
