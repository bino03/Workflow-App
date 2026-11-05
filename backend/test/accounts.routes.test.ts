import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { StateStore } from '../src/state/stateStore.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, removeDir, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'accounts routes password';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

// A fake primary config dir and DATA_DIR in a temporary folder — the real ~/.claude is never touched.
const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-accounts-routes-')));
const root = join(base, 'root');
const project = join(root, 'api-faturas');
const claudeConfig = join(base, 'claude');
mkdirSync(project, { recursive: true });
mkdirSync(join(claudeConfig, 'projects', 'C--x'), { recursive: true });
writeFileSync(join(claudeConfig, 'projects', 'C--x', 'conversa.jsonl'), '{}\n');
writeFileSync(join(claudeConfig, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'principal@example.com' } }));
writeFileSync(join(claudeConfig, '.credentials.json'), '{"claudeAiOauth":{"accessToken":"segredo"}}');

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => removeDir(base));

describe('/api/accounts (ADR 0027)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let dataDir: string;
  let stateStore: StateStore;
  let claude: ReturnType<typeof fakeClaude>;
  let terminalManager: TerminalManager;
  const size = { cols: 100, rows: 30 };

  beforeEach(async () => {
    dataDir = mkdtempSync(join(base, 'data-'));
    claude = fakeClaude();
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: root, DEFAULT_CWD: project, CLAUDE_CONFIG_DIR: claudeConfig, DATA_DIR: dataDir });
    terminalManager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 3, scrollbackBytes: 64 * 1024 });
    stateStore = await testStateStore();
    app = await buildApp({ stateStore, config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
  });
  afterEach(async () => {
    await app.close();
  });

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const add = async (label: string) => (await call('POST', '/api/accounts', { label })).json<{ id: string }>().id;

  it('needs a session', async () => {
    for (const [method, url] of [
      ['GET', '/api/accounts'],
      ['POST', '/api/accounts'],
      ['PUT', '/api/accounts/active'],
      ['PATCH', `/api/accounts/${UNKNOWN}`],
      ['DELETE', `/api/accounts/${UNKNOWN}`],
      ['POST', `/api/accounts/${UNKNOWN}/login`],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('lists the primary first, logged in, without exposing a token', async () => {
    const res = await call('GET', '/api/accounts');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      activeAccountId: 'primary',
      accounts: [
        {
          id: 'primary',
          label: 'Principal',
          isPrimary: true,
          email: 'principal@example.com',
          loggedIn: true,
          runningTerminals: 0,
          usage: { fiveHour: null, weekly: null, fetchedAt: null },
        },
      ],
    });
    expect(res.body).not.toContain('segredo');
  });

  it('creates an account with its folder and links, logged out; a bad name is 400', async () => {
    const res = await call('POST', '/api/accounts', { label: '  Trabalho ' });
    expect(res.statusCode).toBe(201);
    const view = res.json();
    expect(view).toMatchObject({ label: 'Trabalho', isPrimary: false, loggedIn: false, email: null, runningTerminals: 0 });
    expect(existsSync(join(dataDir, 'accounts', view.id, 'projects', 'C--x', 'conversa.jsonl'))).toBe(true);
    expect((await call('GET', '/api/accounts')).json().accounts.map((a: { id: string }) => a.id)).toEqual(['primary', view.id]);

    for (const label of ['', 'a'.repeat(41), '<b>x</b>', 'x$y']) {
      expect((await call('POST', '/api/accounts', { label })).statusCode, label).toBe(400);
    }
  });

  it('5 accounts in total: the 5th extra is ACCOUNT_002', async () => {
    for (const n of [1, 2, 3, 4]) expect((await call('POST', '/api/accounts', { label: `Conta ${n}` })).statusCode).toBe(201);
    const res = await call('POST', '/api/accounts', { label: 'Conta 5' });
    expect(res.statusCode).toBe(409);
    expect(res.json().errorCode).toBe('ACCOUNT_002');
  });

  it('renames an extra account and the primary', async () => {
    const id = await add('Trabalho');
    expect((await call('PATCH', `/api/accounts/${id}`, { label: 'Cliente' })).json().label).toBe('Cliente');
    expect((await call('PATCH', '/api/accounts/primary', { label: 'Pessoal' })).json()).toMatchObject({ id: 'primary', label: 'Pessoal' });
    expect(stateStore.read().primaryAccountLabel).toBe('Pessoal');
    expect((await call('PATCH', `/api/accounts/${UNKNOWN}`, { label: 'x' })).json().errorCode).toBe('ACCOUNT_001');
    expect((await call('PATCH', '/api/accounts/..%2Ffora', { label: 'x' })).json().errorCode).toBe('ACCOUNT_001');
  });

  it('sets the active account, which new terminals and /api/usage follow', async () => {
    const id = await add('Trabalho');
    const res = await call('PUT', '/api/accounts/active', { accountId: id });
    expect(res.statusCode).toBe(200);
    expect(res.json().activeAccountId).toBe(id);
    const terminal = (await call('POST', '/api/terminals', { cwd: project, mode: 'new', ...size })).json();
    expect(terminal.accountId).toBe(id);
    expect(claude.launches.at(-1)!.configDir).toBe(join(dataDir, 'accounts', id));
    expect((await call('PUT', '/api/accounts/active', { accountId: UNKNOWN })).json().errorCode).toBe('ACCOUNT_001');
    expect((await call('PUT', '/api/accounts/active', { accountId: 'qualquer' })).statusCode).toBe(400);
  });

  it('POST /reopen with an accountId moves the terminal there; without one it keeps its account', async () => {
    const id = await add('Trabalho');
    const terminal = (await call('POST', '/api/terminals', { cwd: project, mode: 'new', ...size })).json();
    expect(terminal.accountId).toBe('primary');
    await terminalManager.kill(terminal.id);

    const moved = await call('POST', `/api/terminals/${terminal.id}/reopen`, { ...size, accountId: id });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().accountId).toBe(id);
    expect(claude.launches.at(-1)!.configDir).toBe(join(dataDir, 'accounts', id));
    await terminalManager.kill(terminal.id);

    const kept = await call('POST', `/api/terminals/${terminal.id}/reopen`, size);
    expect(kept.json().accountId).toBe(id);
    await terminalManager.kill(terminal.id);

    const unknown = await call('POST', `/api/terminals/${terminal.id}/reopen`, { ...size, accountId: UNKNOWN });
    expect([unknown.statusCode, unknown.json().errorCode]).toEqual([404, 'ACCOUNT_001']);
  });

  it('the login route opens a visible terminal in that account, in DEFAULT_CWD, whose first message is /login', async () => {
    const id = await add('Trabalho');
    const res = await call('POST', `/api/accounts/${id}/login`, size);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ accountId: id, cwd: project, label: 'Login — Trabalho', hidden: false, status: 'running' });
    expect(claude.launches.at(-1)).toMatchObject({ cwd: project, configDir: join(dataDir, 'accounts', id) });
    expect(claude.launches.at(-1)!.args!.at(-1)).toBe('/login');
    expect((await call('GET', '/api/accounts')).json().accounts[1].runningTerminals).toBe(1);
    expect((await call('POST', `/api/accounts/${UNKNOWN}/login`, size)).json().errorCode).toBe('ACCOUNT_001');
  });

  it('removing: never the primary; refused with a running terminal; then the terminals move to the primary', async () => {
    expect((await call('DELETE', '/api/accounts/primary')).json().errorCode).toBe('ACCOUNT_003');
    const id = await add('Trabalho');
    await call('PUT', '/api/accounts/active', { accountId: id });
    const running = (await call('POST', '/api/terminals', { cwd: project, mode: 'new', ...size })).json();
    const toClose = (await call('POST', '/api/terminals', { cwd: project, mode: 'new', ...size })).json();
    await call('DELETE', `/api/terminals/${toClose.id}`);

    const refused = await call('DELETE', `/api/accounts/${id}`);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().errorCode).toBe('ACCOUNT_004');
    expect(existsSync(join(dataDir, 'accounts', id))).toBe(true);

    // Stopped, as after a backend restart (there is no REST stop): still saved, no longer running.
    await terminalManager.kill(running.id);
    expect((await call('DELETE', `/api/accounts/${id}`)).statusCode).toBe(204);
    expect(existsSync(join(dataDir, 'accounts', id))).toBe(false);
    expect(readFileSync(join(claudeConfig, 'projects', 'C--x', 'conversa.jsonl'), 'utf8')).toBe('{}\n');
    const state = stateStore.read();
    expect(state.accounts).toEqual([]);
    expect(state.activeAccountId).toBe('primary');
    expect(state.terminals.find((t) => t.id === running.id)?.accountId).toBe('primary');
    expect(state.closedTerminals.find((t) => t.id === toClose.id)?.accountId).toBe('primary');
    expect((await call('DELETE', `/api/accounts/${id}`)).json().errorCode).toBe('ACCOUNT_001');
  });
});
