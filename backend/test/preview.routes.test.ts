import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { DevPort } from '../src/preview/listeningPorts.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'preview routes password';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';
const HOST = 'bino.tailb8eca6.ts.net';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-preview-routes-')));
const project = join(base, 'root', 'loja');
mkdirSync(project, { recursive: true });

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** What the fake Tailscale daemon is serving, and the dev ports every terminal "has". */
const served = new Map<number, string>();
let devPorts: DevPort[] = [];
const tailscale = {
  hostName: async () => HOST,
  servedPorts: async () => new Map(served),
  serve: async (https: number, dev: number) => void served.set(https, `http://127.0.0.1:${dev}`),
  off: async (https: number) => void served.delete(https),
};

async function startApp(env: Record<string, string> = {}) {
  const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: join(base, 'root'), ...env });
  const terminalManager = new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 4, scrollbackBytes: 64 * 1024 });
  const app = await buildApp({
    stateStore: await testStateStore(),
    config,
    terminalManager,
    logger: false,
    preview: { tailscale, devPorts: async () => devPorts },
  });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
  const cookie = login.cookies.find((c) => c.name === 'session');
  if (!cookie) throw new Error('no session cookie');
  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie: `session=${cookie.value}` }, ...(payload ? { payload } : {}) });
  return { app, call };
}

const vite: DevPort = { port: 5173, pid: 1, process: 'node.exe' };
const api: DevPort = { port: 8080, pid: 2, process: 'java.exe' };

describe('/api/terminals/:id/preview', () => {
  let app: FastifyInstance;
  let call: Awaited<ReturnType<typeof startApp>>['call'];
  let terminalId: string;

  beforeAll(async () => {
    served.set(8444, 'http://127.0.0.1:9999'); // left by a "crashed" previous run
    served.set(443, 'http://127.0.0.1:3000'); // the owner's own serve
    ({ app, call } = await startApp({ TAILSCALE_BIN: 'tailscale' }));
    const created = await call('POST', '/api/terminals', { cwd: project, mode: 'new', cols: 80, rows: 24 });
    terminalId = created.json().id;
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    devPorts = [vite];
  });

  it('turned off, at startup, the range ports a previous run left — and only those', () => {
    expect([...served.keys()]).toEqual([443]);
  });

  it('needs a session', async () => {
    for (const method of ['POST', 'DELETE'] as const) {
      const res = await app.inject({ method, url: `/api/terminals/${terminalId}/preview` });
      expect(res.statusCode).toBe(401);
      expect(res.json().errorCode).toBe('AUTH_002');
    }
  });

  it('an unknown or malformed id is TERMINAL_001', async () => {
    for (const id of [UNKNOWN, 'not-a-uuid']) {
      expect((await call('POST', `/api/terminals/${id}/preview`)).json().errorCode).toBe('TERMINAL_001');
      expect((await call('DELETE', `/api/terminals/${id}/preview`)).json().errorCode).toBe('TERMINAL_001');
    }
  });

  it('validates the body: devPort must be a port number, nothing else is accepted', async () => {
    for (const payload of [{ devPort: 'x' }, { devPort: 0 }, { devPort: 70000 }, { devPort: 5173.5 }, { httpsPort: 8443 }]) {
      const res = await call('POST', `/api/terminals/${terminalId}/preview`, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().errorCode).toBe('COMMON_001');
    }
  });

  it('several dev ports → 200 with the ports to choose from', async () => {
    devPorts = [vite, api];
    const res = await call('POST', `/api/terminals/${terminalId}/preview`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ports: [vite, api] });
  });

  it('starts, shows up in GET /api/terminals, and stops (204, twice)', async () => {
    const res = await call('POST', `/api/terminals/${terminalId}/preview`, { devPort: 5173 });
    expect(res.statusCode).toBe(200);
    const preview = res.json().preview;
    expect(preview).toMatchObject({ url: `https://${HOST}:8443/`, devPort: 5173, httpsPort: 8443 });
    expect(served.get(8443)).toBe('http://127.0.0.1:5173');

    const list = (await call('GET', '/api/terminals')).json();
    expect(list.find((t: { id: string }) => t.id === terminalId).preview).toEqual(preview);

    expect((await call('DELETE', `/api/terminals/${terminalId}/preview`)).statusCode).toBe(204);
    expect((await call('DELETE', `/api/terminals/${terminalId}/preview`)).statusCode).toBe(204);
    expect(served.has(8443)).toBe(false);
    expect((await call('GET', '/api/terminals')).json().find((t: { id: string }) => t.id === terminalId).preview).toBeNull();
  });

  it('no dev port → 409 PREVIEW_001', async () => {
    devPorts = [];
    const res = await call('POST', `/api/terminals/${terminalId}/preview`);
    expect(res.statusCode).toBe(409);
    expect(res.json().errorCode).toBe('PREVIEW_001');
  });

  it('closing the terminal turns its preview off', async () => {
    const created = await call('POST', '/api/terminals', { cwd: project, mode: 'new', cols: 80, rows: 24 });
    const id = created.json().id;
    await call('POST', `/api/terminals/${id}/preview`);
    expect(served.size).toBe(2); // 443 + this one
    await call('DELETE', `/api/terminals/${id}`);
    await expect.poll(() => served.size).toBe(1);
  });

  it('closing the app turns every preview off', async () => {
    const { app: other, call: callOther } = await startApp({ TAILSCALE_BIN: 'tailscale', PORT: '7401' });
    const id = (await callOther('POST', '/api/terminals', { cwd: project, mode: 'new', cols: 80, rows: 24 })).json().id;
    await callOther('POST', `/api/terminals/${id}/preview`);
    expect(served.size).toBe(2);
    await other.close();
    expect([...served.keys()]).toEqual([443]);
  });
});

describe('with the Telegram bot on', () => {
  it('a preview started from the app is sent to the owner, with an off button; its end too', async () => {
    const sent: { chatId: number; text: string; keyboard?: unknown }[] = [];
    const telegramApi = {
      getUpdates: (_o: number, _t: number, signal?: AbortSignal) =>
        new Promise<never>((_r, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      sendMessage: async (chatId: number, text: string, keyboard?: unknown) => {
        sent.push({ chatId, text, keyboard });
        return { message_id: 1, chat: { id: chatId, type: 'private' as const } };
      },
      editMessageText: async () => true as const,
      answerCallbackQuery: async () => true as const,
      setMyCommands: async () => true as const,
    };
    const config = testConfig({
      APP_PASSWORD_HASH: passwordHash,
      ALLOWED_ROOTS: join(base, 'root'),
      TAILSCALE_BIN: 'tailscale',
      PORT: '7402',
      TELEGRAM_BOT_TOKEN: '7012345678:AAFv1x2y3z4ABCDEFghijklmnopqrstuvwx',
      TELEGRAM_ALLOWED_USER_ID: '555000111',
    });
    const terminalManager = new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 2, scrollbackBytes: 64 * 1024 });
    const app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false, telegramApi, preview: { tailscale, devPorts: async () => [vite] } });
    await app.ready();
    try {
      const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
      const headers = { cookie: `session=${login.cookies.find((c) => c.name === 'session')!.value}` };
      const id = (await app.inject({ method: 'POST', url: '/api/terminals', headers, payload: { cwd: project, mode: 'new', cols: 80, rows: 24 } })).json().id;
      await app.inject({ method: 'POST', url: `/api/terminals/${id}/preview`, headers });
      await expect.poll(() => sent.length).toBe(1);
      expect(sent[0]).toMatchObject({ chatId: 555000111, text: expect.stringContaining(`https://${HOST}:8443/`) });
      expect(JSON.stringify(sent[0]!.keyboard)).toContain('Desligar');
      await app.inject({ method: 'DELETE', url: `/api/terminals/${id}/preview`, headers });
      await expect.poll(() => sent.at(-1)?.text).toBe('⏹ Link de loja desligado.');
    } finally {
      await app.close();
    }
  });
});

describe('without TAILSCALE_BIN', () => {
  it('the routes exist and answer 404 PREVIEW_006; terminals show preview: null', async () => {
    const { app, call } = await startApp();
    const id = (await call('POST', '/api/terminals', { cwd: project, mode: 'new', cols: 80, rows: 24 })).json().id;
    const res = await call('POST', `/api/terminals/${id}/preview`);
    expect(res.statusCode).toBe(404);
    expect(res.json().errorCode).toBe('PREVIEW_006');
    expect((await call('GET', '/api/terminals')).json()[0].preview).toBeNull();
    await app.close();
  });
});
