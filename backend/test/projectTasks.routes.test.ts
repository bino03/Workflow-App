import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MAX_TASKS_PER_PROJECT, type ProjectTask } from '../src/projectTasks/projectTasks.schemas.js';
import type { StateStore } from '../src/state/stateStore.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'project tasks test password';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

let base: string;
let root: string;
let project: string;
let other: string;
let passwordHash: string;

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'wfa-project-tasks-'));
  root = join(base, 'root');
  mkdirSync(join(root, 'alpha'), { recursive: true });
  mkdirSync(join(root, 'beta'), { recursive: true });
  mkdirSync(join(base, 'outside'), { recursive: true });
  project = realpathSync.native(join(root, 'alpha'));
  other = realpathSync.native(join(root, 'beta'));
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('/api/project-tasks (ADR 0037)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let stateStore: StateStore;

  beforeEach(async () => {
    const config = testConfig({ ALLOWED_ROOTS: root, APP_PASSWORD_HASH: passwordHash });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    stateStore = await testStateStore();
    app = await buildApp({ stateStore, config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
  });
  afterEach(async () => {
    await app.close();
  });

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const list = async (path = project) =>
    (await call('GET', `/api/project-tasks?${new URLSearchParams({ projectPath: path }).toString()}`)).json<ProjectTask[]>();
  const add = (text: string, path = project) => call('POST', '/api/project-tasks', { projectPath: path, text });

  it('needs a session on every route', async () => {
    for (const [method, url] of [
      ['GET', '/api/project-tasks'],
      ['POST', '/api/project-tasks'],
      ['PATCH', `/api/project-tasks/${UNKNOWN}`],
      ['DELETE', `/api/project-tasks/${UNKNOWN}`],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json()).toMatchObject({ errorCode: 'AUTH_002' });
    }
  });

  it('adds tasks in creation order (newest last), per project, trimmed', async () => {
    expect(await list()).toEqual([]);
    const first = await add('  escrever o ADR  ');
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ projectPath: project, text: 'escrever o ADR', done: false, doneAt: null });
    await add('testar no browser');
    await add('outro projeto', other);
    expect((await list()).map((task) => task.text)).toEqual(['escrever o ADR', 'testar no browser']);
    expect((await list(other)).map((task) => task.text)).toEqual(['outro projeto']);
    expect(stateStore.read().projectTasks).toHaveLength(3);
  });

  it('marks done (with doneAt) and back, and edits the text, keeping the place', async () => {
    const a = (await add('a')).json<ProjectTask>();
    await add('b');
    const done = await call('PATCH', `/api/project-tasks/${a.id}`, { done: true });
    expect(done.statusCode).toBe(200);
    expect(done.json<ProjectTask>().doneAt).toMatch(/^\d{4}-/);
    const undone = (await call('PATCH', `/api/project-tasks/${a.id}`, { done: false, text: 'a2' })).json<ProjectTask>();
    expect(undone).toMatchObject({ done: false, doneAt: null, text: 'a2' });
    expect((await list()).map((task) => task.text)).toEqual(['a2', 'b']);
  });

  it('deletes for real and "Desfazer" brings it back with the same id, place and state', async () => {
    const a = (await add('a')).json<ProjectTask>();
    await add('b');
    await call('PATCH', `/api/project-tasks/${a.id}`, { done: true });
    const removed = await call('DELETE', `/api/project-tasks/${a.id}`);
    expect(removed.statusCode).toBe(200);
    const task = removed.json<ProjectTask>();
    expect(task).toMatchObject({ id: a.id, done: true });
    expect((await list()).map((t) => t.text)).toEqual(['b']);

    const restored = await call('POST', '/api/project-tasks', {
      projectPath: project,
      text: task.text,
      restore: { id: task.id, createdAt: task.createdAt, done: task.done, doneAt: task.doneAt },
    });
    expect(restored.statusCode).toBe(201);
    expect(restored.json()).toEqual(task);
    expect((await list()).map((t) => t.id)[0]).toBe(a.id);

    const again = await call('POST', '/api/project-tasks', {
      projectPath: project,
      text: task.text,
      restore: { id: task.id, createdAt: task.createdAt, done: task.done, doneAt: task.doneAt },
    });
    expect([again.statusCode, again.json().errorCode]).toEqual([409, 'TASK_003']);
  });

  it(`refuses the ${MAX_TASKS_PER_PROJECT + 1}th task of a project (TASK_002), not of another`, async () => {
    stateStore.update((draft) => {
      for (let i = 0; i < MAX_TASKS_PER_PROJECT; i += 1) {
        draft.projectTasks.push({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          projectPath: project,
          text: `t${i}`,
          done: false,
          doneAt: null,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        });
      }
    });
    const res = await add('a mais');
    expect([res.statusCode, res.json().errorCode]).toEqual([409, 'TASK_002']);
    expect((await add('noutro', other)).statusCode).toBe(201);
  });

  it('TASK_001 for an unknown id; FOLDER_001 outside ALLOWED_ROOTS; COMMON_001 for bad bodies', async () => {
    expect((await call('PATCH', `/api/project-tasks/${UNKNOWN}`, { done: true })).json()).toMatchObject({ errorCode: 'TASK_001' });
    expect((await call('DELETE', `/api/project-tasks/${UNKNOWN}`)).json()).toMatchObject({ errorCode: 'TASK_001' });

    const outside = await add('x', join(base, 'outside'));
    expect([outside.statusCode, outside.json().errorCode]).toEqual([403, 'FOLDER_001']);
    expect((await call('GET', `/api/project-tasks?projectPath=${encodeURIComponent(join(base, 'outside'))}`)).json()).toMatchObject({ errorCode: 'FOLDER_001' });

    for (const body of [{ projectPath: project }, { projectPath: project, text: '   ' }, { projectPath: project, text: 'x'.repeat(201) }]) {
      const res = await call('POST', '/api/project-tasks', body);
      expect([res.statusCode, res.json().errorCode]).toEqual([400, 'COMMON_001']);
    }
    const a = (await add('a')).json<ProjectTask>();
    expect((await call('PATCH', `/api/project-tasks/${a.id}`, {})).json()).toMatchObject({ errorCode: 'COMMON_001' });
    expect((await call('PATCH', '/api/project-tasks/not-a-uuid', { done: true })).json()).toMatchObject({ errorCode: 'COMMON_001' });
  });
});
