import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'folders and sessions password';
const OLD = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-folders-')));
const root = join(base, 'root');
const project = join(root, 'api-faturas');
const sandbox = join(root, 'Sandbox');
const doomed = join(root, 'apagar-depois');
const outside = join(base, 'outside');
const claudeConfig = join(base, 'claude');
for (const dir of [join(project, 'src'), sandbox, doomed, join(root, '.git'), outside]) mkdirSync(dir, { recursive: true });
symlinkSync(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');

const sessionFolder = new ClaudeSessions(claudeConfig).folderOf(project);
mkdirSync(sessionFolder, { recursive: true });
for (const [id, title, when] of [
  [OLD, 'Sessão antiga', '2026-09-20T10:00:00Z'],
  [NEW, 'Validação de NIF', '2026-09-26T18:42:00Z'],
] as const) {
  const file = join(sessionFolder, `${id}.jsonl`);
  writeFileSync(file, `${JSON.stringify({ type: 'ai-title', aiTitle: title })}\n`);
  utimesSync(file, new Date(when), new Date(when));
}

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  const config = testConfig({
    APP_PASSWORD_HASH: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
    ALLOWED_ROOTS: root,
    CLAUDE_CONFIG_DIR: claudeConfig,
  });
  const terminalManager = new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 4, scrollbackBytes: 1024 });
  app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
  cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
});

afterAll(async () => {
  await app.close();
  rmSync(base, { recursive: true, force: true });
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
const q = (value: string) => encodeURIComponent(value);
const favorite = (path: string, value: boolean) =>
  app.inject({ method: 'PUT', url: '/api/folders/favorite', headers: { cookie }, payload: { path, favorite: value } });

describe('/api/folders', () => {
  it('needs a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/folders' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `/api/folders/browse?path=${q(root)}` })).statusCode).toBe(401);
  });

  it('browse: one level, sorted, hidden folders and junctions left out, never above the root', async () => {
    const atRoot = (await get(`/api/folders/browse?path=${q(root)}`)).json();
    expect(atRoot).toEqual({
      path: root,
      parent: null,
      entries: [
        { name: 'apagar-depois', path: doomed, sessionCount: 0 },
        { name: 'api-faturas', path: project, sessionCount: 2 },
        { name: 'Sandbox', path: sandbox, sessionCount: 0 },
      ],
    });
    const inProject = (await get(`/api/folders/browse?path=${q(project)}`)).json();
    expect(inProject).toMatchObject({ path: project, parent: root, entries: [{ name: 'src' }] });
  });

  it('browse refuses outside the roots, and a missing path is a validation error', async () => {
    const res = await get(`/api/folders/browse?path=${q(outside)}`);
    expect([res.statusCode, res.json().errorCode]).toEqual([403, 'FOLDER_001']);
    expect((await get('/api/folders/browse')).json().errorCode).toBe('COMMON_001');
  });

  it('opening a terminal makes a recent; favourites move out of recents; un-favouriting a never-used one forgets it', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/terminals',
      headers: { cookie },
      payload: { cwd: project, mode: 'new', cols: 80, rows: 24 },
    });
    await app.inject({ method: 'DELETE', url: `/api/terminals/${created.json().id}`, headers: { cookie } });

    let list = (await get('/api/folders')).json();
    expect(list.roots).toEqual([root]);
    expect(list.recents.map((f: { path: string }) => f.path)).toEqual([project]);
    expect(list.favorites).toEqual([]);

    expect((await favorite(sandbox, true)).statusCode).toBe(204);
    expect((await favorite(project, true)).statusCode).toBe(204);
    list = (await get('/api/folders')).json();
    expect(list.favorites.map((f: { path: string }) => f.path).sort()).toEqual([project, sandbox].sort());
    expect(list.recents).toEqual([]);

    await favorite(sandbox, false);
    await favorite(project, false);
    list = (await get('/api/folders')).json();
    expect(list.favorites).toEqual([]);
    expect(list.recents.map((f: { path: string }) => f.path)).toEqual([project]); // used once: stays as a recent
  });

  it('a favourite that no longer exists is not listed', async () => {
    await favorite(doomed, true);
    rmSync(doomed, { recursive: true });
    expect((await get('/api/folders')).json().favorites).toEqual([]);
  });

  it('favourite refuses outside the roots and validates the body', async () => {
    const outsideRes = await favorite(outside, true);
    expect([outsideRes.statusCode, outsideRes.json().errorCode]).toEqual([403, 'FOLDER_001']);
    const bad = await app.inject({ method: 'PUT', url: '/api/folders/favorite', headers: { cookie }, payload: { path: project } });
    expect(bad.json().errorCode).toBe('COMMON_001');
  });
});

describe('/api/sessions', () => {
  it('lists the saved sessions of a folder, newest first, with openIn and the closed terminal', async () => {
    let sessions = (await get(`/api/sessions?cwd=${q(project)}`)).json();
    expect(sessions.map((s: { id: string }) => s.id)).toEqual([NEW, OLD]);
    expect(sessions[0]).toMatchObject({ preview: 'Validação de NIF', closed: null, openIn: null });

    const created = await app.inject({
      method: 'POST',
      url: '/api/terminals',
      headers: { cookie },
      payload: { cwd: project, mode: 'resume', sessionId: OLD, label: 'antiga', cols: 80, rows: 24 },
    });
    const id = created.json().id;
    sessions = (await get(`/api/sessions?cwd=${q(project)}`)).json();
    expect(sessions.find((s: { id: string }) => s.id === OLD).openIn).toBe(id);

    await app.inject({ method: 'DELETE', url: `/api/terminals/${id}`, headers: { cookie } });
    sessions = (await get(`/api/sessions?cwd=${q(project)}`)).json();
    expect(sessions.find((s: { id: string }) => s.id === OLD)).toMatchObject({
      openIn: null,
      closed: { label: 'antiga', summary: 'Sessão antiga', closedAt: expect.any(String) },
    });
  });

  it('refuses a folder outside the roots', async () => {
    const res = await get(`/api/sessions?cwd=${q(outside)}`);
    expect([res.statusCode, res.json().errorCode]).toEqual([403, 'FOLDER_001']);
  });
});
