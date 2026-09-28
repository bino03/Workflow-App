import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { ClaudeBinError, type SpawnPty } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'terminals routes password';
const SAVED = '9089b683-e79e-4bd7-9d4b-69f6fd40cc0a';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-terminal-routes-')));
const root = join(base, 'root');
const project = join(root, 'api-faturas');
const empty = join(root, 'sandbox');
const claudeConfig = join(base, 'claude');
mkdirSync(project, { recursive: true });
mkdirSync(empty);
const sessionFolder = new ClaudeSessions(claudeConfig).folderOf(project);
mkdirSync(sessionFolder, { recursive: true });
writeFileSync(join(sessionFolder, `${SAVED}.jsonl`), `${JSON.stringify({ type: 'ai-title', aiTitle: 'Migração' })}\n`);

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

async function startApp(spawn: SpawnPty) {
  const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: root, CLAUDE_CONFIG_DIR: claudeConfig });
  const terminalManager = new TerminalManager({ spawn, maxTerminals: 2, scrollbackBytes: 64 * 1024 });
  const app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
  const cookie = login.cookies.find((c) => c.name === 'session');
  if (!cookie) throw new Error('no session cookie');
  return { app, cookie: `session=${cookie.value}` };
}

describe('/api/terminals', () => {
  let app: FastifyInstance;
  let cookie: string;
  const size = { cols: 100, rows: 30 };

  beforeAll(async () => {
    ({ app, cookie } = await startApp(fakeClaude().spawn));
  });
  afterAll(async () => {
    await app.close();
  });

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });

  it('needs a session', async () => {
    for (const [method, url] of [
      ['GET', '/api/terminals'],
      ['POST', '/api/terminals'],
      ['DELETE', `/api/terminals/${UNKNOWN}`],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(401);
      expect(res.json().errorCode).toBe('AUTH_002');
    }
  });

  it('validates the body: missing size, resume without sessionId, a label with markup', async () => {
    const missing = await call('POST', '/api/terminals', { cwd: project, mode: 'new' });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().fieldErrors.map((e: { field: string }) => e.field).sort()).toEqual(['cols', 'rows']);

    const resume = await call('POST', '/api/terminals', { cwd: project, mode: 'resume', ...size });
    expect(resume.json().fieldErrors).toEqual([{ field: 'sessionId', message: 'required when mode is resume' }]);

    const label = await call('POST', '/api/terminals', { cwd: project, mode: 'new', label: '<script>', ...size });
    expect(label.statusCode).toBe(400);
    expect(label.json().fieldErrors[0].field).toBe('label');
  });

  it('maps the service errors: outside the roots, missing session, nothing to continue', async () => {
    const outside = await call('POST', '/api/terminals', { cwd: base, mode: 'new', ...size });
    expect([outside.statusCode, outside.json().errorCode]).toEqual([403, 'FOLDER_001']);
    const missing = await call('POST', '/api/terminals', { cwd: project, mode: 'resume', sessionId: UNKNOWN, ...size });
    expect([missing.statusCode, missing.json().errorCode]).toEqual([404, 'TERMINAL_004']);
    const nothing = await call('POST', '/api/terminals', { cwd: empty, mode: 'continue', ...size });
    expect([nothing.statusCode, nothing.json().errorCode]).toEqual([404, 'SESSION_001']);
  });

  it('create → list → rename → reopen refused while running → close', async () => {
    const created = await call('POST', '/api/terminals', { cwd: project, mode: 'continue', label: 'faturas', ...size });
    expect(created.statusCode).toBe(201);
    const view = created.json();
    expect(view).toMatchObject({ cwd: project, label: 'faturas', claudeSessionId: SAVED, status: 'running' });

    expect((await call('GET', '/api/terminals')).json()).toMatchObject([{ id: view.id, status: 'running' }]);

    const renamed = await call('PATCH', `/api/terminals/${view.id}`, { label: 'faturas (prisma)' });
    expect(renamed.json().label).toBe('faturas (prisma)');
    expect((await call('PATCH', `/api/terminals/${view.id}`, { label: null })).json().label).toBeNull();

    const reopen = await call('POST', `/api/terminals/${view.id}/reopen`, size);
    expect([reopen.statusCode, reopen.json().errorCode]).toEqual([409, 'TERMINAL_006']);

    expect((await call('DELETE', `/api/terminals/${view.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/api/terminals')).json()).toEqual([]);
    const again = await call('DELETE', `/api/terminals/${view.id}`);
    expect([again.statusCode, again.json().errorCode]).toEqual([404, 'TERMINAL_001']);
  });

  it('an unknown or malformed id is TERMINAL_001', async () => {
    for (const id of [UNKNOWN, 'not-a-uuid']) {
      const res = await call('PATCH', `/api/terminals/${id}`, { label: 'x' });
      expect([res.statusCode, res.json().errorCode]).toEqual([404, 'TERMINAL_001']);
    }
  });

  it('MAX_TERMINALS → 409 TERMINAL_002', async () => {
    const opened = [];
    for (let i = 0; i < 2; i++) opened.push((await call('POST', '/api/terminals', { cwd: empty, mode: 'new', ...size })).json());
    const third = await call('POST', '/api/terminals', { cwd: empty, mode: 'new', ...size });
    expect([third.statusCode, third.json().errorCode]).toEqual([409, 'TERMINAL_002']);
    for (const view of opened) await call('DELETE', `/api/terminals/${view.id}`);
  });
});

describe('/api/terminals without a claude binary', () => {
  it('→ 503 TERMINAL_005', async () => {
    const { app, cookie } = await startApp(() => {
      throw new ClaudeBinError('CLAUDE_BIN "claude" not found on PATH');
    });
    const res = await app.inject({ method: 'POST', url: '/api/terminals', headers: { cookie }, payload: { cwd: project, mode: 'new', cols: 80, rows: 24 } });
    expect([res.statusCode, res.json().errorCode]).toEqual([503, 'TERMINAL_005']);
    await app.close();
  });
});
