import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'branches test password';
let base: string;
let root: string;
let repo: string;
let passwordHash: string;

beforeAll(async () => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-branches-routes-')));
  root = join(base, 'root');
  repo = join(root, 'repo');
  mkdirSync(join(repo, '.git', 'refs', 'heads'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(repo, '.git', 'refs', 'heads', 'main'), '0123456789abcdef0123456789abcdef01234567\n');
  writeFileSync(join(repo, '.git', 'refs', 'heads', 'dev'), '0123456789abcdef0123456789abcdef01234567\n');
  mkdirSync(join(base, 'outside'));
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('GET /api/branches', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeEach(async () => {
    const config = testConfig({ ALLOWED_ROOTS: root, APP_PASSWORD_HASH: passwordHash });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
  });
  afterEach(async () => {
    await app.close();
  });

  const get = (path?: string, withCookie = true) =>
    app.inject({ method: 'GET', url: `/api/branches${path ? `?${new URLSearchParams({ path })}` : ''}`, headers: withCookie ? { cookie } : {} });

  it('needs a session', async () => {
    const res = await get(repo, false);
    expect([res.statusCode, res.json().errorCode]).toEqual([401, 'AUTH_002']);
  });

  it('lists the branches, current first', async () => {
    const res = await get(repo);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ current: 'main', branches: ['main', 'dev'] });
  });

  it('FOLDER_001 outside ALLOWED_ROOTS; COMMON_001 without a path', async () => {
    expect((await get(join(base, 'outside'))).json()).toMatchObject({ errorCode: 'FOLDER_001' });
    expect((await get()).json()).toMatchObject({ errorCode: 'COMMON_001' });
  });
});
