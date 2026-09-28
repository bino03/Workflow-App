import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_ORIGIN, TEST_USERNAME as USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'correct horse battery staple';
const INDEX_HTML = '<!doctype html><title>Workflow App</title><div id="root"></div>';
const ASSET_JS = 'console.log("app")';

let workDir: string;
let distDir: string;
let passwordHash: string;

beforeAll(async () => {
  // A fake build: dist/ with index.html + a fingerprinted asset, and a file just outside dist/.
  workDir = mkdtempSync(join(tmpdir(), 'workflow-app-spa-'));
  distDir = join(workDir, 'dist');
  mkdirSync(join(distDir, 'assets'), { recursive: true });
  writeFileSync(join(distDir, 'index.html'), INDEX_HTML);
  writeFileSync(join(distDir, 'assets', 'index-abc123.js'), ASSET_JS);
  writeFileSync(join(workDir, 'secret.txt'), 'outside dist');
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function noTerminals() {
  return new TerminalManager({
    spawn: () => {
      throw new Error('no spawn in spa tests');
    },
    maxTerminals: 1,
    scrollbackBytes: 1024,
  });
}

describe('SPA served by the backend', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const config = testConfig({ FRONTEND_DIST: distDir, APP_PASSWORD_HASH: passwordHash, PORT: '7400' });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager: noTerminals(), logger: false });
    app.get('/api/test/ws', { websocket: true }, (socket) => {
      socket.on('message', () => socket.send('pong'));
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / without a session → index.html, revalidated on every load', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body).toBe(INDEX_HTML);
  });

  it.each(['/terminals', '/library/some-skill', '/login?next=%2Fterminals'])(
    'client-side route %s → index.html',
    async (url) => {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.body).toBe(INDEX_HTML);
    },
  );

  it('fingerprinted asset → served with an immutable cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.body).toBe(ASSET_JS);
  });

  it('missing asset → JSON 404, not index.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/gone-999.js' });
    expect(res.statusCode).toBe(404);
    expect(res.json().errorCode).toBe('COMMON_003');
  });

  it('non-GET outside /api → JSON 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/terminals' });
    expect(res.statusCode).toBe(404);
    expect(res.json().errorCode).toBe('COMMON_003');
  });

  it('unknown /api route without a session → still 401 (routes are not revealed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_002');
  });

  it('the API keeps answering JSON', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it.each(['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/assets/..%2f..%2fsecret.txt'])(
    'path traversal %s never reaches files outside dist',
    async (url) => {
      const res = await app.inject({ method: 'GET', url });
      expect(res.body).not.toContain('outside dist');
    },
  );

  describe('WebSocket Origin', () => {
    async function sessionCookie(): Promise<string> {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: USERNAME, password: PASSWORD } });
      const cookie = res.cookies.find((c) => c.name === 'session');
      if (!cookie) throw new Error('no session cookie');
      return `session=${cookie.value}`;
    }

    it.each(['http://localhost:7400', 'http://127.0.0.1:7400'])('the backend’s own origin %s is accepted', async (origin) => {
      const ws = await app.injectWS('/api/test/ws', { headers: { cookie: await sessionCookie(), origin } });
      ws.terminate();
    });

    it('the configured dev origin is still accepted', async () => {
      const ws = await app.injectWS('/api/test/ws', { headers: { cookie: await sessionCookie(), origin: TEST_ORIGIN } });
      ws.terminate();
    });

    it('a foreign origin is still refused', async () => {
      const cookie = await sessionCookie();
      await expect(app.injectWS('/api/test/ws', { headers: { cookie, origin: 'https://evil.example' } })).rejects.toThrow(/403/);
    });

    it('the own origin without a session is still refused', async () => {
      await expect(app.injectWS('/api/test/ws', { headers: { origin: 'http://localhost:7400' } })).rejects.toThrow(/401/);
    });
  });
});

describe('without a frontend build', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ stateStore: await testStateStore(), config: testConfig(), terminalManager: noTerminals(), logger: false });
    app.get('/api/test/ws', { websocket: true }, (socket) => socket.close());
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('a path outside /api → JSON 404 (no session needed to learn there is no page)', async () => {
    const res = await app.inject({ method: 'GET', url: '/terminals' });
    expect(res.statusCode).toBe(404);
    expect(res.json().errorCode).toBe('COMMON_003');
  });

  it('the backend’s own origin is not added to the WebSocket origins', async () => {
    await expect(app.injectWS('/api/test/ws', { headers: { origin: 'http://localhost:7400' } })).rejects.toThrow(/403/);
  });
});

describe('WebSocket outside /api', () => {
  it('still needs a session — the SPA exemption is for plain HTTP only', async () => {
    const app = await buildApp({ stateStore: await testStateStore(), config: testConfig({ FRONTEND_DIST: distDir }), terminalManager: noTerminals(), logger: false });
    app.get('/elsewhere/ws', { websocket: true }, (socket) => socket.close());
    await app.ready();
    try {
      await expect(app.injectWS('/elsewhere/ws', { headers: { origin: TEST_ORIGIN } })).rejects.toThrow(/401/);
    } finally {
      await app.close();
    }
  });
});
