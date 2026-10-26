import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { registerErrorHandler } from '../src/common/errors.js';
import { guidedRoutes } from '../src/guided/guided.routes.js';
import { GUIDED_FILES, writeGuidedFiles } from '../src/guided/guidedFiles.js';
import { GuidedService } from '../src/guided/guidedService.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';
import { fakeClaude, waitFor } from './fakeClaude.js';
import { removeDir, testConfig, testStateStore } from './helpers.js';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-guided-routes-')));
const workflow = join(base, 'root', 'Workflow');
const dataDir = join(base, 'data');
mkdirSync(workflow, { recursive: true });
afterAll(() => removeDir(base));

it('every /api/guided route needs a session (the whole app)', async () => {
  const app = await buildApp({
    config: testConfig({ DATA_DIR: dataDir }),
    terminalManager: new TerminalManager({ spawn: fakeClaude().spawn, maxTerminals: 1, scrollbackBytes: 1024 }),
    stateStore: await testStateStore(),
    logger: false,
  });
  const id = randomUUID();
  for (const [method, url] of [
    ['GET', `/api/guided/${id}`],
    ['POST', `/api/guided/${id}/answer`],
    ['POST', `/api/guided/${id}/permission`],
    ['POST', `/api/guided/${id}/message`],
    ['POST', `/api/guided/${id}/resume`],
    ['POST', `/api/guided/${id}/reveal`],
    ['DELETE', `/api/guided/${id}`],
  ] as const) {
    expect((await app.inject({ method, url, payload: method === 'POST' ? {} : undefined })).statusCode).toBe(401);
  }
  await app.close();
});

/**
 * The guided routes over a real TerminalsService with the fake claude. The routes start nothing (that is the
 * purpose's own route, /api/creations), so the session is started through the service.
 */
describe('/api/guided', () => {
  let app: FastifyInstance;
  let claude: ReturnType<typeof fakeClaude>;
  let terminalManager: TerminalManager;
  let terminals: TerminalsService;
  let guided: GuidedService;

  beforeAll(async () => {
    claude = fakeClaude();
    terminalManager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 3, scrollbackBytes: 64 * 1024 });
    terminals = new TerminalsService({
      stateStore: await testStateStore(),
      terminalManager,
      sessions: new ClaudeSessions(join(base, 'claude')),
      allowedRoots: [join(base, 'root')],
      guidedSettingsPath: writeGuidedFiles(dataDir, [join(base, 'root')]),
      isTrustedFolder: async () => true,
    });
    guided = new GuidedService({ dataDir, terminals });
    app = Fastify();
    registerErrorHandler(app);
    await app.register(guidedRoutes, { guidedService: guided });
  });
  afterAll(async () => {
    await app.close();
    await terminalManager.killAll();
  });

  const dirOf = (id: string) => join(dataDir, GUIDED_FILES.dir, id);
  const setEvent = (id: string, event: string) => writeFileSync(join(dirOf(id), 'event.json'), JSON.stringify({ event, at: new Date().toISOString() }));
  const start = () => guided.start({ purpose: 'create', cwd: workflow, input: 'Uma app de ginásio' });

  it('the launch: guided --settings, --add-dir, --permission-mode default, /create --app <brief> last; hidden', async () => {
    const view = await start();
    const { args, cwd } = claude.launches.at(-1)!;
    expect(cwd).toBe(workflow);
    expect(args!.slice(0, 2)).toEqual(['--add-dir', dirOf(view.id)]);
    expect(args).toEqual(expect.arrayContaining(['--settings', join(dataDir, GUIDED_FILES.settings), '--permission-mode', 'default']));
    expect(args!.at(-1)).toBe(`/create --app ${join(dirOf(view.id), 'brief.md')}`);
    expect(terminals.list().map((t) => t.id)).not.toContain(view.terminalId);
    expect(terminals.get(view.terminalId)).toMatchObject({ hidden: true, guidedId: view.id });

    const response = await app.inject({ method: 'GET', url: `/api/guided/${view.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: view.id, status: 'working', pending: null });
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.id}` });
  });

  it('message: 409 while working; once waiting, a cleaned bracketed paste then Enter reach the PTY', async () => {
    const view = await start();
    const message = (text: string) => app.inject({ method: 'POST', url: `/api/guided/${view.id}/message`, payload: { text } });
    expect((await message('olá')).json()).toMatchObject({ errorCode: 'GUIDED_004' });
    expect((await message('   ')).statusCode).toBe(400);

    setEvent(view.id, 'Stop');
    // What goes into the PTY (ConPTY's echo strips escape sequences, so the echo cannot prove it).
    const writes: string[] = [];
    const write = terminalManager.write.bind(terminalManager);
    terminalManager.write = (id, data) => {
      if (id === view.terminalId) writes.push(String(data));
      write(id, data);
    };
    let received = '';
    terminalManager.attach(view.terminalId, { onData: (d) => (received += d), onExit: () => {} });
    try {
      expect((await message('linha 1\r\nlinha 2\x1b[201~\x07fim')).statusCode).toBe(204);
    } finally {
      terminalManager.write = write;
    }
    // The paste never ends early (one end marker), and Enter goes apart from it.
    expect(writes).toEqual(['\x1b[200~linha 1\nlinha 2[201~fim\x1b[201~', '\r']);
    await waitFor(() => received.includes('linha 2[201~fim'));
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.id}` });
  });

  it('answer / permission: a request that is not waiting → GUIDED_002; a bad body → 400', async () => {
    const view = await start();
    const answer = await app.inject({ method: 'POST', url: `/api/guided/${view.id}/answer`, payload: { requestId: randomUUID(), answers: { a: 'b' } } });
    expect(answer.statusCode).toBe(409);
    expect(answer.json()).toMatchObject({ errorCode: 'GUIDED_002' });
    const permission = await app.inject({ method: 'POST', url: `/api/guided/${view.id}/permission`, payload: { requestId: randomUUID(), decision: 'allow' } });
    expect(permission.json()).toMatchObject({ errorCode: 'GUIDED_002' });
    expect((await app.inject({ method: 'POST', url: `/api/guided/${view.id}/permission`, payload: { requestId: 'x', decision: 'maybe' } })).statusCode).toBe(400);
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.id}` });
  });

  it('a question answered through the route: the hook gets answer-<requestId>.json', async () => {
    const view = await start();
    const requestId = randomUUID();
    const questions = [{ question: 'Que forma tem a app?', header: 'Forma', multiSelect: false, options: [{ label: 'Back-office', description: '' }] }];
    writeFileSync(join(dirOf(view.id), `pending-${requestId}.json`), JSON.stringify({ type: 'question', requestId, pid: process.pid, at: new Date().toISOString(), questions }));
    const current = (await app.inject({ method: 'GET', url: `/api/guided/${view.id}` })).json();
    expect(current).toMatchObject({ status: 'question', pending: { requestId, questions } });
    const response = await app.inject({ method: 'POST', url: `/api/guided/${view.id}/answer`, payload: { requestId, answers: { 'Que forma tem a app?': 'Back-office' } } });
    expect(response.statusCode).toBe(204);
    expect(readdirSync(dirOf(view.id))).toContain(`answer-${requestId}.json`);
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.id}` });
  });

  it('reveal puts the terminal in the grid; resume of a running one → TERMINAL_006; DELETE → gone', async () => {
    const view = await start();
    expect((await app.inject({ method: 'POST', url: `/api/guided/${view.id}/reveal` })).json()).toMatchObject({ id: view.terminalId, hidden: false });
    expect(terminals.list().map((t) => t.id)).toContain(view.terminalId);
    const resume = await app.inject({ method: 'POST', url: `/api/guided/${view.id}/resume`, payload: { cols: 100, rows: 30 } });
    expect(resume.json()).toMatchObject({ errorCode: 'TERMINAL_006' });

    expect((await app.inject({ method: 'DELETE', url: `/api/guided/${view.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/guided/${view.id}` })).json()).toMatchObject({ errorCode: 'GUIDED_001' });
    expect(terminals.get(view.terminalId)).toBeUndefined();
  });

  it('resume after the process stopped: reopened with the same guided arguments, waiting for text', async () => {
    const view = await start();
    await terminals.stop(view.terminalId);
    expect((await app.inject({ method: 'GET', url: `/api/guided/${view.id}` })).json()).toMatchObject({ status: 'stopped' });
    const before = claude.launches.length;
    const resumed = await app.inject({ method: 'POST', url: `/api/guided/${view.id}/resume`, payload: { cols: 100, rows: 30 } });
    expect(resumed.json()).toMatchObject({ status: 'waiting-text' });
    const args = claude.launches[before]!.args!;
    expect(args).toEqual(expect.arrayContaining(['--settings', join(dataDir, GUIDED_FILES.settings), '--permission-mode', 'default', '--add-dir', dirOf(view.id)]));
    expect(args.some((a) => a.startsWith('/create'))).toBe(false);
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.id}` });
  });

  it('an unknown id or one that is not a UUID → 404 GUIDED_001', async () => {
    for (const id of [randomUUID(), '..%2Fx']) {
      const response = await app.inject({ method: 'GET', url: `/api/guided/${id}` });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ errorCode: 'GUIDED_001' });
    }
  });
});
