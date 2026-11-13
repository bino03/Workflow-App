import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { DevPort } from '../src/preview/listeningPorts.js';
import { claudeJsonPath } from '../src/sessions/claudeTrust.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { removeDir, TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'app run routes password';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-apprun-routes-')));
const root = join(base, 'root');
const project = join(root, 'loja');
const bare = join(root, 'sem-skills');
const self = join(root, 'workflow-app');
const claudeConfig = join(base, 'claude');
for (const dir of [project, bare, self, claudeConfig]) mkdirSync(dir, { recursive: true });
for (const dir of [project, self]) {
  for (const name of ['run', 'stop']) {
    mkdirSync(join(dir, '.claude', 'skills', name), { recursive: true });
    writeFileSync(join(dir, '.claude', 'skills', name, 'SKILL.md'), `# ${name}\n`);
  }
}
// The project is a folder Claude Code already trusts (a launch with nobody at the PTY needs it).
writeFileSync(claudeJsonPath(claudeConfig), JSON.stringify({ projects: { [root.replace(/\\/g, '/')]: { hasTrustDialogAccepted: true } } }));

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => removeDir(base));

/** The ports every terminal "has" below it. */
let devPorts: DevPort[] = [];

describe('/api/app-runs (ADR 0030)', () => {
  let app: FastifyInstance;
  let claude: ReturnType<typeof fakeClaude>;
  let call: (method: 'GET' | 'POST', url: string, payload?: object, cookie?: string | null) => Promise<LightMyRequestResponse>;

  beforeAll(async () => {
    claude = fakeClaude();
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: root, CLAUDE_CONFIG_DIR: claudeConfig });
    app = await buildApp({
      stateStore: await testStateStore(),
      config,
      terminalManager: new TerminalManager({ spawn: claude.spawn, maxTerminals: 4, scrollbackBytes: 64 * 1024 }),
      logger: false,
      appRuns: { devPorts: async () => devPorts, selfPath: self },
    });
    await app.ready();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    const session = login.cookies.find((c) => c.name === 'session')!.value;
    call = (method, url, payload, cookie = session) =>
      app.inject({ method, url, headers: cookie ? { cookie: `session=${cookie}` } : {}, ...(payload ? { payload } : {}) });
  });
  afterAll(async () => {
    await app.close();
  });

  const query = (path: string) => `/api/app-runs?path=${encodeURIComponent(path)}`;

  it('every route needs a session', async () => {
    for (const [method, url, payload] of [
      ['GET', query(project)],
      ['POST', '/api/app-runs', { path: project }],
      ['POST', '/api/app-runs/stop', { path: project }],
      ['POST', '/api/app-runs/reveal', { path: project }],
    ] as const) {
      const response = await call(method, url, payload, null);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
      expect(response.json().errorCode).toBe('AUTH_002');
    }
    expect(claude.launches).toEqual([]);
  });

  it('validates the path: missing or extra fields are COMMON_001, outside ALLOWED_ROOTS is FOLDER_001', async () => {
    expect((await call('GET', '/api/app-runs')).json().errorCode).toBe('COMMON_001');
    expect((await call('POST', '/api/app-runs', { path: project, cmd: 'npm run dev' })).json().errorCode).toBe('COMMON_001');
    const outside = await call('POST', '/api/app-runs', { path: base });
    expect(outside.statusCode).toBe(403);
    expect(outside.json().errorCode).toBe('FOLDER_001');
    expect(claude.launches).toEqual([]);
  });

  it('the Workflow App itself and a project without the skills are unavailable, and Correr is refused there', async () => {
    expect((await call('GET', query(self))).json()).toMatchObject({ phase: 'unavailable', unavailableReason: 'self' });
    const own = await call('POST', '/api/app-runs', { path: self });
    expect([own.statusCode, own.json().errorCode]).toEqual([422, 'APPRUN_004']);

    expect((await call('GET', query(bare))).json()).toMatchObject({ phase: 'unavailable', unavailableReason: 'missing-skills' });
    const noSkills = await call('POST', '/api/app-runs', { path: bare });
    expect([noSkills.statusCode, noSkills.json().errorCode]).toEqual([422, 'APPRUN_002']);
    expect(claude.launches).toEqual([]);
  });

  it('Correr → a hidden /run terminal (not in the grid) → running with its ports → Ver terminal → Parar', async () => {
    expect((await call('GET', query(project))).json()).toMatchObject({ phase: 'idle', terminalId: null });
    expect((await call('POST', '/api/app-runs/stop', { path: project })).json().errorCode).toBe('APPRUN_003');

    const started = await call('POST', '/api/app-runs', { path: project });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ path: project, phase: 'starting', unavailableReason: null });
    const { terminalId } = started.json();
    expect(claude.launches.at(-1)?.args?.at(-1)).toBe('/run');
    expect((await call('GET', '/api/terminals')).json()).toEqual([]);

    const twice = await call('POST', '/api/app-runs', { path: project });
    expect([twice.statusCode, twice.json().errorCode]).toEqual([409, 'APPRUN_001']);

    devPorts = [{ port: 5173, pid: 1, process: 'node.exe' }];
    await vi.waitFor(async () => expect((await call('GET', query(project))).json().phase).toBe('running'), { timeout: 10_000 });
    expect((await call('GET', query(project))).json()).toMatchObject({ phase: 'running', ports: [5173], terminalId });

    const revealed = await call('POST', '/api/app-runs/reveal', { path: project });
    expect(revealed.json()).toEqual({ terminalId });
    expect((await call('GET', '/api/terminals')).json().map((t: { id: string }) => t.id)).toEqual([terminalId]);

    const stopping = await call('POST', '/api/app-runs/stop', { path: project });
    expect(stopping.json().phase).toBe('stopping');
    devPorts = [];
    await vi.waitFor(async () => expect((await call('GET', query(project))).json().phase).toBe('idle'), { timeout: 30_000, interval: 200 });
    expect((await call('GET', '/api/terminals')).json()).toEqual([]);
  }, 60_000);
});
