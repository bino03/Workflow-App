import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { GUIDED_FILES } from '../src/guided/guidedFiles.js';
import { claudeJsonPath } from '../src/sessions/claudeTrust.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, removeDir, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'creation routes password';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-creation-routes-')));
const root = join(base, 'root');
const workflow = join(root, 'Workflow');
const created = join(root, 'projetos', 'Ginasio');
const outside = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-creation-outside-')));
const claudeConfig = join(base, 'claude');
const dataDir = join(base, 'data');
for (const dir of [join(workflow, 'library'), created, claudeConfig]) mkdirSync(dir, { recursive: true });
// The Workflow is a folder Claude Code already trusts.
writeFileSync(claudeJsonPath(claudeConfig), JSON.stringify({ projects: { [workflow.replace(/\\/g, '/')]: { hasTrustDialogAccepted: true } } }));

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => {
  removeDir(base);
  removeDir(outside);
});

describe('/api/creations', () => {
  let app: FastifyInstance;
  let cookie: string;
  let claude: ReturnType<typeof fakeClaude>;

  beforeAll(async () => {
    claude = fakeClaude();
    const config = testConfig({
      APP_PASSWORD_HASH: passwordHash,
      ALLOWED_ROOTS: root,
      WORKFLOW_PATH: workflow,
      CLAUDE_CONFIG_DIR: claudeConfig,
      DATA_DIR: dataDir,
    });
    const terminalManager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 3, scrollbackBytes: 64 * 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    const current = (await app.inject({ method: 'GET', url: '/api/creations/current', headers: { cookie } })).json() as { id: string } | null;
    if (current) await app.inject({ method: 'DELETE', url: `/api/guided/${current.id}`, headers: { cookie } });
  });

  const create = (description: unknown) => app.inject({ method: 'POST', url: '/api/creations', payload: { description }, headers: { cookie } });
  const writeResult = (id: string, result: object) =>
    writeFileSync(join(dataDir, GUIDED_FILES.dir, id, 'result.json'), JSON.stringify({ version: 1, summary: '', ...result }));

  it('needs a session', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/creations', payload: { description: 'x' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/creations/current' })).statusCode).toBe(401);
  });

  it('201: the brief is written, claude runs /create --app <brief> in the Workflow, hidden; current is it', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/creations/current', headers: { cookie } })).json()).toBeNull();
    const response = await create('  Uma app para gerir as reservas do meu ginásio.\n"$(rm -rf /)" --x  ');
    expect(response.statusCode).toBe(201);
    const view = response.json() as { id: string; status: string; purpose: string; terminalId: string };
    expect(view).toMatchObject({ status: 'working', purpose: 'create' });

    const brief = join(dataDir, GUIDED_FILES.dir, view.id, 'brief.md');
    expect(readFileSync(brief, 'utf8')).toBe('Uma app para gerir as reservas do meu ginásio.\n"$(rm -rf /)" --x\n');
    const { args, cwd } = claude.launches.at(-1)!;
    expect(cwd).toBe(workflow);
    expect(args!.at(-1)).toBe(`/create --app ${brief}`);
    // The description never reaches the command line.
    expect(args!.join(' ')).not.toContain('ginásio');
    expect(args).toEqual(expect.arrayContaining(['--permission-mode', 'default']));

    const terminals = (await app.inject({ method: 'GET', url: '/api/terminals', headers: { cookie } })).json() as { id: string }[];
    expect(terminals.map((t) => t.id)).not.toContain(view.terminalId);
    expect((await app.inject({ method: 'GET', url: '/api/creations/current', headers: { cookie } })).json()).toMatchObject({ id: view.id });
  });

  it('a second creation while one is open → 409 CREATE_001', async () => {
    expect((await create('primeira')).statusCode).toBe(201);
    const second = await create('segunda');
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ errorCode: 'CREATE_001' });
  });

  it('an empty or too long description → 400', async () => {
    for (const description of ['', '   ', 'x'.repeat(8001), 42]) expect((await create(description)).statusCode).toBe(400);
  });

  it('result.json done → the view carries it; open → a visible terminal in the project folder', async () => {
    const { id } = (await create('ginásio')).json() as { id: string };
    const notYet = await app.inject({ method: 'POST', url: `/api/creations/${id}/open`, headers: { cookie } });
    expect(notYet.json()).toMatchObject({ errorCode: 'CREATE_002' });

    writeResult(id, { status: 'done', projectPath: created, projectName: 'Ginasio', summary: '# Feito', openDecisions: ['Hosting'], nextStep: '/implement-todo' });
    const current = (await app.inject({ method: 'GET', url: '/api/creations/current', headers: { cookie } })).json();
    expect(current).toMatchObject({ id, status: 'done', result: { projectName: 'Ginasio', openDecisions: ['Hosting'] } });

    const opened = await app.inject({ method: 'POST', url: `/api/creations/${id}/open`, headers: { cookie } });
    expect(opened.statusCode).toBe(201);
    expect(opened.json()).toMatchObject({ cwd: created, hidden: false, guidedId: null });
    expect(claude.launches.at(-1)!.cwd).toBe(created);
    const terminals = (await app.inject({ method: 'GET', url: '/api/terminals', headers: { cookie } })).json() as { id: string }[];
    expect(terminals.map((t) => t.id)).toContain((opened.json() as { id: string }).id);
    await app.inject({ method: 'DELETE', url: `/api/terminals/${(opened.json() as { id: string }).id}`, headers: { cookie } });
  });

  it('open: a folder outside ALLOWED_ROOTS → FOLDER_001; one that does not exist, or a failed result → CREATE_002', async () => {
    const { id } = (await create('ginásio')).json() as { id: string };
    const open = () => app.inject({ method: 'POST', url: `/api/creations/${id}/open`, headers: { cookie } });
    writeResult(id, { status: 'done', projectPath: outside });
    expect((await open()).json()).toMatchObject({ errorCode: 'FOLDER_001' });
    writeResult(id, { status: 'done', projectPath: join(root, 'projetos', 'NaoExiste') });
    expect((await open()).json()).toMatchObject({ errorCode: 'CREATE_002' });
    writeResult(id, { status: 'failed', projectPath: created, error: 'Cancelado pelo utilizador' });
    expect((await open()).json()).toMatchObject({ errorCode: 'CREATE_002' });
  });

  it('after Fechar (DELETE /api/guided/:id) a new creation can start', async () => {
    const { id } = (await create('primeira')).json() as { id: string };
    expect((await app.inject({ method: 'DELETE', url: `/api/guided/${id}`, headers: { cookie } })).statusCode).toBe(204);
    expect((await create('segunda')).statusCode).toBe(201);
  });
});
