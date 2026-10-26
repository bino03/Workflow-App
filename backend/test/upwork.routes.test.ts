import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { GUIDED_FILES } from '../src/guided/guidedFiles.js';
import { claudeJsonPath } from '../src/sessions/claudeTrust.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { PROFILE_TEMPLATE, UPWORK_FILES } from '../src/upwork/upworkFiles.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, removeDir, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'upwork routes password';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-upwork-routes-')));
const root = join(base, 'root');
const workflow = join(root, 'Workflow');
const claudeConfig = join(base, 'claude');
const dataDir = join(base, 'data');
const profileFile = join(dataDir, UPWORK_FILES.dir, UPWORK_FILES.profile);
for (const dir of [join(workflow, 'library'), claudeConfig]) mkdirSync(dir, { recursive: true });
writeFileSync(claudeJsonPath(claudeConfig), JSON.stringify({ projects: { [workflow.replace(/\\/g, '/')]: { hasTrustDialogAccepted: true } } }));

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => removeDir(base));

type View = {
  id: string;
  title: string;
  status: string;
  history: { status: string; at: string }[];
  guidedId: string;
  url: string | null;
  guided: { id: string; purpose: string; status: string; terminalId: string } | null;
  package: unknown;
};

const JOB = '# React dashboard for a logistics startup\n\nWe need a dispatcher dashboard. "$(rm -rf /)" --x';

describe('/api/upwork', () => {
  let app: FastifyInstance;
  let cookie: string;
  let claude: ReturnType<typeof fakeClaude>;
  const opened: string[] = [];

  beforeAll(async () => {
    claude = fakeClaude();
    const config = testConfig({ APP_PASSWORD_HASH: passwordHash, ALLOWED_ROOTS: root, WORKFLOW_PATH: workflow, CLAUDE_CONFIG_DIR: claudeConfig, DATA_DIR: dataDir });
    const terminalManager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 3, scrollbackBytes: 64 * 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
  });
  afterAll(async () => {
    await app.close();
  });
  // Each application holds a terminal: close their sessions so the next test has room (MAX_TERMINALS 3).
  afterEach(async () => {
    for (const guidedId of opened.splice(0)) await app.inject({ method: 'DELETE', url: `/api/guided/${guidedId}`, headers: { cookie } });
  });

  const inject = (method: 'GET' | 'PUT' | 'POST' | 'PATCH', url: string, payload?: object) => app.inject({ method, url, payload, headers: { cookie } });
  const putProfile = (markdown: unknown) => inject('PUT', '/api/upwork/profile', { markdown });
  async function apply(body: object = { job: JOB, screeningQuestions: ['Describe a recent dashboard.', 'Which UI library?'] }) {
    const response = await inject('POST', '/api/upwork/applications', body);
    if (response.statusCode === 201) opened.push((response.json() as View).guidedId);
    return response;
  }

  it('needs a session', async () => {
    for (const [method, url] of [
      ['GET', '/api/upwork/profile'],
      ['PUT', '/api/upwork/profile'],
      ['GET', '/api/upwork/applications'],
      ['POST', '/api/upwork/applications'],
      ['PATCH', '/api/upwork/applications/x'],
    ] as const) {
      expect((await app.inject({ method, url, payload: {} })).statusCode).toBe(401);
    }
  });

  it('profile: the template until saved; PUT saves it in DATA_DIR/upwork and GET reads it back', async () => {
    expect((await inject('GET', '/api/upwork/profile')).json()).toEqual({ markdown: PROFILE_TEMPLATE, updatedAt: null });
    for (const markdown of ['', '   ', 'x'.repeat(20_001), 42]) expect((await putProfile(markdown)).statusCode).toBe(400);
    const saved = await putProfile('# Quem sou\nEstudante, a começar.');
    expect(saved.statusCode).toBe(200);
    expect(readFileSync(profileFile, 'utf8')).toBe('# Quem sou\nEstudante, a começar.\n');
    expect((await inject('GET', '/api/upwork/profile')).json()).toMatchObject({ markdown: '# Quem sou\nEstudante, a começar.\n', updatedAt: expect.any(String) });
  });

  it('POST without a profile → 409 UPWORK_002, and nothing starts', async () => {
    removeDir(join(dataDir, UPWORK_FILES.dir));
    const launches = claude.launches.length;
    const response = await apply();
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ errorCode: 'UPWORK_002' });
    expect(claude.launches).toHaveLength(launches);
  });

  it('POST 201: record + hidden guided session running /upwork-proposal --app <job.md>, with the profile copied next to it', async () => {
    await putProfile('# Quem sou\nPerfil do dia.');
    const response = await apply({ job: JOB, screeningQuestions: ['  Describe a recent dashboard. ', 'Which UI library?'], url: 'https://www.upwork.com/jobs/~01abc' });
    expect(response.statusCode).toBe(201);
    const view = response.json() as View;
    expect(view).toMatchObject({
      title: 'React dashboard for a logistics startup',
      status: 'draft',
      url: 'https://www.upwork.com/jobs/~01abc',
      archived: false,
      package: null,
      guided: { id: view.guidedId, purpose: 'upwork', status: 'working' },
    });
    expect(view.history).toEqual([{ status: 'draft', at: expect.any(String) }]);

    const sessionDir = join(dataDir, GUIDED_FILES.dir, view.guidedId);
    const job = readFileSync(join(sessionDir, 'job.md'), 'utf8');
    expect(job).toContain('We need a dispatcher dashboard.');
    expect(job).toContain('1. Describe a recent dashboard.\n2. Which UI library?');
    expect(job).toContain(view.id);
    // ADR 0022 point 1: the URL never reaches the session.
    expect(job).not.toContain('upwork.com');
    expect(readFileSync(join(sessionDir, 'profile.md'), 'utf8')).toBe('# Quem sou\nPerfil do dia.\n');

    const { args, cwd } = claude.launches.at(-1)!;
    expect(cwd).toBe(workflow);
    expect(args!.at(-1)).toBe(`/upwork-proposal --app ${join(sessionDir, 'job.md')}`);
    expect(args!.join(' ')).not.toContain('dispatcher');
    const terminals = (await inject('GET', '/api/terminals')).json() as { id: string }[];
    expect(terminals.map((t) => t.id)).not.toContain(view.guided!.terminalId);

    // The copy is fixed: a later profile does not change this application's.
    await putProfile('# Quem sou\nOutro perfil.');
    expect(readFileSync(join(sessionDir, 'profile.md'), 'utf8')).toBe('# Quem sou\nPerfil do dia.\n');
  });

  it('POST validation: job required and ≤ 20 000, ≤ 15 questions, the URL only https://www.upwork.com/… → 400', async () => {
    await putProfile('# Quem sou');
    for (const body of [
      {},
      { job: '   ' },
      { job: 'x'.repeat(20_001) },
      { job: 'x', screeningQuestions: Array.from({ length: 16 }, () => 'q') },
      { job: 'x', screeningQuestions: [''] },
      { job: 'x', url: 'https://evil.example/jobs' },
      { job: 'x', url: 'http://www.upwork.com/jobs/~1' },
      { job: 'x', url: 'https://www.upwork.com.evil.example/' },
    ]) {
      expect((await apply(body)).statusCode, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
  });

  it('list: most recent first, the open ones by default; GET one; an unknown or odd id → 404 UPWORK_001', async () => {
    await putProfile('# Quem sou');
    const first = (await apply({ job: 'Primeiro job' })).json() as View;
    const second = (await apply({ job: 'Segundo job' })).json() as View;
    const ids = ((await inject('GET', '/api/upwork/applications')).json() as View[]).map((v) => v.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    expect((await inject('GET', '/api/upwork/applications?archived=true')).json()).toEqual([]);
    expect((await inject('GET', '/api/upwork/applications?archived=maybe')).statusCode).toBe(400);
    expect((await inject('GET', `/api/upwork/applications/${first.id}`)).json()).toMatchObject({ id: first.id, title: 'Primeiro job' });
    for (const id of ['00000000-0000-4000-8000-000000000000', '..%2F..%2Fx']) {
      expect((await inject('GET', `/api/upwork/applications/${id}`)).json()).toMatchObject({ errorCode: 'UPWORK_001' });
    }
  });

  it('PATCH: fields change; each status change joins the history, the same status does not; free (any to any)', async () => {
    await putProfile('# Quem sou');
    const { id } = (await apply({ job: 'Job' })).json() as View;
    const patch = (body: object) => inject('PATCH', `/api/upwork/applications/${id}`, body);
    expect((await patch({ clientName: 'Acme', connectsSpent: 12, notes: 'boa conversa' })).json()).toMatchObject({ clientName: 'Acme', connectsSpent: 12, notes: 'boa conversa' });
    await patch({ status: 'interview' });
    await patch({ status: 'interview' });
    const won = (await patch({ status: 'won' })).json() as View;
    expect(won.history.map((h) => h.status)).toEqual(['draft', 'interview', 'won']);
    expect(((await patch({ status: 'draft' })).json() as View).status).toBe('draft');

    for (const body of [{}, { status: 'hired' }, { connectsSpent: 501 }, { connectsSpent: -1 }, { notes: 'x'.repeat(8001) }, { url: 'https://evil.example/' }]) {
      expect((await patch(body)).statusCode, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    expect((await inject('PATCH', '/api/upwork/applications/00000000-0000-4000-8000-000000000000', { notes: 'x' })).json()).toMatchObject({ errorCode: 'UPWORK_001' });
  });

  it('a session removed by hand leaves the application readable, with guided null', async () => {
    await putProfile('# Quem sou');
    const view = (await apply({ job: 'Job' })).json() as View;
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.guidedId}`, headers: { cookie } });
    expect(existsSync(join(dataDir, GUIDED_FILES.dir, view.guidedId))).toBe(false);
    expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({ id: view.id, guided: null });
  });
});
