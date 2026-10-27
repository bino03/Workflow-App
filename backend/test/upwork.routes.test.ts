import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { GUIDED_FILES } from '../src/guided/guidedFiles.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
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
// The portfolio (ADR 0024): one project with a screenshot, a secret outside its images folder, and a junction out.
const portfolio = join(base, 'portfolio');
const portfolioImages = join(portfolio, 'public', 'images', 'projects');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
for (const dir of [join(workflow, 'library'), claudeConfig, join(portfolioImages, 'demo'), join(base, 'outside')]) mkdirSync(dir, { recursive: true });
writeFileSync(join(portfolioImages, 'demo', 'lista de pedidos.png'), PNG);
writeFileSync(join(portfolio, 'secret.png'), 'segredo');
writeFileSync(join(base, 'outside', 'escape.png'), 'segredo');
symlinkSync(join(base, 'outside'), join(portfolioImages, 'escape'), 'junction');
// Preparar anexos (ADR 0025): the folders the backend asked to show — a fake, so no Explorer window opens.
const shownFolders: string[] = [];
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
    const config = testConfig({
      APP_PASSWORD_HASH: passwordHash,
      ALLOWED_ROOTS: root,
      WORKFLOW_PATH: workflow,
      CLAUDE_CONFIG_DIR: claudeConfig,
      DATA_DIR: dataDir,
      PORTFOLIO_PATH: portfolio,
    });
    const terminalManager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 3, scrollbackBytes: 64 * 1024 });
    app = await buildApp({
      stateStore: await testStateStore(),
      config,
      terminalManager,
      logger: false,
      openFolder: (folder) => {
        shownFolders.push(folder);
        return true;
      },
    });
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

  describe('the package (spec step 5)', () => {
    const PACKAGE = {
      version: 1,
      title: 'React dashboard — logistics',
      language: 'en',
      verdict: 'apply',
      updatedAt: '2026-10-26T15:30:00.000Z',
      files: { analysis: 'analysis.md', coverLetter: 'cover-letter.md', screening: 'screening.md', plan: 'plan.md', clientQuestions: 'client-questions.md' },
    };
    const writePackage = (guidedId: string, manifest: object = PACKAGE) => {
      const dir = join(dataDir, GUIDED_FILES.dir, guidedId);
      for (const [name, text] of [['analysis.md', '**Vale a pena: sim.**'], ['cover-letter.md', 'Your dispatchers need…'], ['screening.md', '## 1. Q\nA'], ['plan.md', '## Abordagem']] as [string, string][]) {
        writeFileSync(join(dir, name), text);
      }
      writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
    };

    it('read from package.json: the five parts (a missing one is null), and the title the skill gave', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Primeira linha do anúncio' })).json() as View;
      expect(view.package).toBeNull();
      writePackage(view.guidedId);
      expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({
        title: 'React dashboard — logistics',
        package: { verdict: 'apply', language: 'en', analysis: '**Vale a pena: sim.**', coverLetter: 'Your dispatchers need…', clientQuestions: null },
        packageError: null,
      });
    });

    it('an invalid package.json, or one naming a file outside the folder, is packageError — and nothing outside is read', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      writeFileSync(join(dataDir, 'secret.md'), 'segredo');
      for (const [manifest, field] of [
        [{ ...PACKAGE, files: { ...PACKAGE.files, analysis: '../../secret.md' } }, 'files.analysis'],
        [{ ...PACKAGE, files: { ...PACKAGE.files, plan: 'C:\\\\x\\\\plan.md' } }, 'files.plan'],
        [{ ...PACKAGE, verdict: 'yes' }, 'verdict'],
        [{ ...PACKAGE, version: 2 }, 'version'],
      ] as const) {
        writePackage(view.guidedId, manifest);
        const read = (await inject('GET', `/api/upwork/applications/${view.id}`)).json() as View & { packageError: string };
        expect(read.package).toBeNull();
        expect(read.packageError).toContain(field);
        expect(JSON.stringify(read)).not.toContain('segredo');
      }
    });

    it('PATCH to sent pauses the session (its terminal stops); Pausar does the same; another status does not', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      expect(((await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'interview' })).json() as View).guided!.status).not.toBe('stopped');
      expect(((await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'sent' })).json() as View).guided!.status).toBe('stopped');
      // Paused already: fine.
      expect(((await inject('POST', `/api/upwork/applications/${view.id}/pause`)).json() as View).guided!.status).toBe('stopped');
    });

    it('message to a paused application: resumes (--resume), waits for SessionStart and a quiet screen, then pastes', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      await inject('POST', `/api/upwork/applications/${view.id}/pause`);
      const sessionDir = join(dataDir, GUIDED_FILES.dir, view.guidedId);
      // The conversation the real claude would have saved: so the reopen is a --resume.
      const { claudeSessionId } = JSON.parse(readFileSync(join(sessionDir, 'meta.json'), 'utf8')) as { claudeSessionId: string };
      const transcripts = new ClaudeSessions(claudeConfig).folderOf(workflow);
      mkdirSync(transcripts, { recursive: true });
      writeFileSync(join(transcripts, `${claudeSessionId}.jsonl`), '');
      // What the guided hook writes when the real claude starts up.
      const sessionStart = setTimeout(() => writeFileSync(join(sessionDir, 'event.json'), JSON.stringify({ event: 'SessionStart', at: new Date().toISOString() })), 500);
      try {
        const response = await inject('POST', `/api/upwork/applications/${view.id}/message`, { text: '  O cliente respondeu: olá  ' });
        expect(response.statusCode).toBe(204);
      } finally {
        clearTimeout(sessionStart);
      }
      const { args } = claude.launches.at(-1)!;
      expect(args).toEqual(expect.arrayContaining(['--resume', '--permission-mode', 'default']));
      expect(args!.join(' ')).not.toContain('/upwork-proposal');
      const read = (await inject('GET', `/api/upwork/applications/${view.id}`)).json() as View;
      expect(read.guided!.status).not.toBe('stopped');
      expect((await inject('POST', `/api/upwork/applications/${view.id}/message`, { text: '' })).statusCode).toBe(400);
    });

    it('archive: the package is copied, the session closed and deleted, the title kept; then UPWORK_004/005', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Primeira linha' })).json() as View;
      writePackage(view.guidedId);
      const archived = await inject('POST', `/api/upwork/applications/${view.id}/archive`);
      expect(archived.statusCode).toBe(200);
      expect(archived.json()).toMatchObject({ archived: true, guidedId: null, guided: null, title: 'React dashboard — logistics', package: { coverLetter: 'Your dispatchers need…' } });
      opened.splice(opened.indexOf(view.guidedId), 1);
      expect(existsSync(join(dataDir, GUIDED_FILES.dir, view.guidedId))).toBe(false);
      const record = JSON.parse(readFileSync(join(dataDir, UPWORK_FILES.dir, UPWORK_FILES.applications, view.id, UPWORK_FILES.record), 'utf8'));
      expect(record.title).toBe('React dashboard — logistics');

      expect(((await inject('GET', '/api/upwork/applications')).json() as View[]).map((v) => v.id)).not.toContain(view.id);
      expect(((await inject('GET', '/api/upwork/applications?archived=true')).json() as View[]).map((v) => v.id)).toContain(view.id);
      expect((await inject('PATCH', `/api/upwork/applications/${view.id}`, { notes: 'x' })).json()).toMatchObject({ errorCode: 'UPWORK_004' });
      expect((await inject('POST', `/api/upwork/applications/${view.id}/archive`)).json()).toMatchObject({ errorCode: 'UPWORK_004' });
      expect((await inject('POST', `/api/upwork/applications/${view.id}/pause`)).json()).toMatchObject({ errorCode: 'UPWORK_004' });
      expect((await inject('POST', `/api/upwork/applications/${view.id}/message`, { text: 'olá' })).json()).toMatchObject({ errorCode: 'UPWORK_005' });
    });

    it('DELETE: the record, its archived package and its session go; then 404', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      const deleted = await app.inject({ method: 'DELETE', url: `/api/upwork/applications/${view.id}`, headers: { cookie } });
      expect(deleted.statusCode).toBe(204);
      opened.splice(opened.indexOf(view.guidedId), 1);
      expect(existsSync(join(dataDir, UPWORK_FILES.dir, UPWORK_FILES.applications, view.id))).toBe(false);
      expect(existsSync(join(dataDir, GUIDED_FILES.dir, view.guidedId))).toBe(false);
      expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({ errorCode: 'UPWORK_001' });
    });
  });

  describe('the screenshots to attach (ADR 0024)', () => {
    const ITEM = {
      project: 'Demo',
      slug: 'demo',
      file: 'lista de pedidos.png',
      uploadName: 'demo-01-request-list.png',
      caption: 'Request list with status tabs.',
    };
    const ATTACHMENTS = {
      version: 1,
      updatedAt: '2026-10-27T15:00:00.000Z',
      items: [ITEM, { ...ITEM, file: 'not-there.png', uploadName: 'demo-02-gone.png' }, { ...ITEM, slug: 'escape', file: 'escape.png', uploadName: 'demo-03-escape.png' }],
      missing: ['GymApp'],
    };
    const writeAttachments = (guidedId: string, content: object = ATTACHMENTS) =>
      writeFileSync(join(dataDir, GUIDED_FILES.dir, guidedId, 'attachments.json'), JSON.stringify(content));
    type WithAttachments = View & {
      attachments: { portfolioConfigured: boolean; items: { uploadName: string; available: boolean }[]; missing: string[] } | null;
      attachmentsError: string | null;
    };
    const image = (id: string, index: number | string, query = '') => inject('GET', `/api/upwork/applications/${id}/attachments/${index}${query}`);

    it('needs a session', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/upwork/applications/x/attachments/0' })).statusCode).toBe(401);
    });

    it('read from attachments.json: each item says whether its image is there; none yet → null, no error', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as WithAttachments;
      expect(view).toMatchObject({ attachments: null, attachmentsError: null });
      writeAttachments(view.guidedId);
      const read = (await inject('GET', `/api/upwork/applications/${view.id}`)).json() as WithAttachments;
      expect(read.attachmentsError).toBeNull();
      expect(read.attachments).toMatchObject({ portfolioConfigured: true, missing: ['GymApp'] });
      // The third one is a junction out of the images folder: not available.
      expect(read.attachments!.items.map((item) => item.available)).toEqual([true, false, false]);
    });

    it('served from the portfolio: inline for the thumbnail, as a download under its uploadName', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      writeAttachments(view.guidedId);
      const inline = await image(view.id, 0);
      expect(inline.statusCode).toBe(200);
      expect(inline.headers['content-type']).toBe('image/png');
      expect(inline.headers['content-disposition']).toBe('inline; filename="demo-01-request-list.png"');
      expect(inline.headers['x-content-type-options']).toBe('nosniff');
      expect(inline.rawPayload.equals(PNG)).toBe(true);
      expect((await image(view.id, 0, '?download=1')).headers['content-disposition']).toBe('attachment; filename="demo-01-request-list.png"');
    });

    it('a missing image, a junction out, an index past the list → 404 UPWORK_006; an odd index → 400; never the outside file', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      writeAttachments(view.guidedId);
      for (const index of [1, 2, 3, 9]) {
        const response = await image(view.id, index);
        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ errorCode: 'UPWORK_006' });
        expect(response.body).not.toContain('segredo');
      }
      for (const index of ['-1', '10', 'x', '0.5']) expect((await image(view.id, index)).statusCode).toBe(400);
      expect((await image(view.id, 0, '?download=yes')).statusCode).toBe(400);
      expect((await image('00000000-0000-4000-8000-000000000000', 0)).json()).toMatchObject({ errorCode: 'UPWORK_001' });
    });

    it('an invalid attachments.json (a path, a bad uploadName, not an image) is attachmentsError — the package still reads', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      for (const [items, field] of [
        [[{ ...ITEM, file: '../../secret.png' }], 'items.0.file'],
        [[{ ...ITEM, file: 'C:\\secret.png' }], 'items.0.file'],
        [[{ ...ITEM, file: 'notes.md' }], 'items.0.file'],
        [[{ ...ITEM, uploadName: 'x".png' }], 'items.0.uploadName'],
        [[{ ...ITEM, slug: '../demo' }], 'items.0.slug'],
      ] as const) {
        writeAttachments(view.guidedId, { ...ATTACHMENTS, items });
        const read = (await inject('GET', `/api/upwork/applications/${view.id}`)).json() as WithAttachments;
        expect(read.attachments).toBeNull();
        expect(read.attachmentsError).toContain(field);
        expect((await image(view.id, 0)).statusCode).toBe(404);
      }
    });

    it('Preparar anexos: copies the available ones under their uploadName into anexos/, skips the rest, shows the folder', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      // The page opened at this machine: loopback + a localhost Origin (the Vite dev server's, here).
      const prepare = (origin: string | null = 'http://localhost:7401', remoteAddress = '127.0.0.1') =>
        app.inject({
          method: 'POST',
          url: `/api/upwork/applications/${view.id}/attachments/prepare`,
          headers: origin ? { cookie, origin } : { cookie },
          remoteAddress,
        });
      // Nothing listed yet → 409, and no window.
      const shownBefore = shownFolders.length;
      expect((await prepare()).json()).toMatchObject({ errorCode: 'UPWORK_007' });
      expect(shownFolders).toHaveLength(shownBefore);

      const folder = join(dataDir, UPWORK_FILES.dir, UPWORK_FILES.applications, view.id, 'anexos');
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, 'old-selection.png'), 'antes');
      // The same uploadName twice: the first one stays.
      writeAttachments(view.guidedId, { ...ATTACHMENTS, items: [...ATTACHMENTS.items, { ...ITEM, uploadName: 'demo-01-request-list.png' }] });
      const response = await prepare();
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        folder,
        files: ['demo-01-request-list.png'],
        skipped: ['demo-02-gone.png', 'demo-03-escape.png', 'demo-01-request-list.png'],
        opened: true,
      });
      expect(shownFolders.at(-1)).toBe(folder);
      expect(readFileSync(join(folder, 'demo-01-request-list.png')).equals(PNG)).toBe(true);
      // Emptied first: only the last preparation is there — and never the file outside.
      expect(existsSync(join(folder, 'old-selection.png'))).toBe(false);
      expect(existsSync(join(folder, 'demo-03-escape.png'))).toBe(false);

      // From the laptop (ADR 0026): the copies are made, nothing opens on this machine. Behind tailscale serve the request
      // comes from loopback but the Origin is the tailnet name; with no Origin, or from another address, the same.
      for (const [origin, address] of [
        ['https://box.tail1234.ts.net', '127.0.0.1'],
        [null, '127.0.0.1'],
        ['http://localhost:7401', '100.64.0.7'],
        ['http://192.168.1.20:7400', '127.0.0.1'],
      ] as const) {
        const shown = shownFolders.length;
        writeFileSync(join(folder, 'old-selection.png'), 'antes');
        const remote = await prepare(origin, address);
        expect(remote.json()).toMatchObject({ folder, files: ['demo-01-request-list.png'], opened: false });
        expect(shownFolders).toHaveLength(shown);
        expect(existsSync(join(folder, 'old-selection.png'))).toBe(false);
      }
      for (const origin of ['http://127.0.0.1:7400', 'http://[::1]:7400']) {
        expect((await prepare(origin)).json()).toMatchObject({ opened: true });
      }

      // Only missing images → 409.
      writeAttachments(view.guidedId, { ...ATTACHMENTS, items: [ATTACHMENTS.items[1]!] });
      expect((await prepare()).json()).toMatchObject({ errorCode: 'UPWORK_007' });
      expect((await app.inject({ method: 'POST', url: `/api/upwork/applications/${view.id}/attachments/prepare` })).statusCode).toBe(401);
    });

    it('archive keeps the list: the archived application still shows and serves its screenshots', async () => {
      await putProfile('# Quem sou');
      const view = (await apply({ job: 'Job' })).json() as View;
      const dir = join(dataDir, GUIDED_FILES.dir, view.guidedId);
      writeFileSync(join(dir, 'cover-letter.md'), 'Letter');
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          version: 1,
          title: 'T',
          language: 'en',
          verdict: 'apply',
          updatedAt: '2026-10-26T15:30:00.000Z',
          files: { analysis: 'analysis.md', coverLetter: 'cover-letter.md', screening: 'screening.md', plan: 'plan.md', clientQuestions: 'client-questions.md' },
        }),
      );
      writeAttachments(view.guidedId);
      const archived = (await inject('POST', `/api/upwork/applications/${view.id}/archive`)).json() as WithAttachments;
      opened.splice(opened.indexOf(view.guidedId), 1);
      expect(archived.attachments!.items).toHaveLength(3);
      expect((await image(view.id, 0)).statusCode).toBe(200);
    });
  });

  describe('Criar projeto (spec step 6)', () => {
    const won = async (job = '# Dashboard para a Acme\n\nUm painel de entregas.') => {
      await putProfile('# Quem sou');
      const view = (await apply({ job })).json() as View;
      const dir = join(dataDir, GUIDED_FILES.dir, view.guidedId);
      writeFileSync(join(dir, 'cover-letter.md'), 'CARTA: Your dispatchers need one screen.');
      writeFileSync(join(dir, 'plan.md'), 'PLANO: React + Ant Design, ~5 dias.');
      writeFileSync(join(dir, 'client-questions.md'), 'PERGUNTAS: Who are the dispatchers?');
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ version: 1, title: 'Acme dashboard', language: 'en', verdict: 'apply', updatedAt: new Date().toISOString(), files: { analysis: 'analysis.md', coverLetter: 'cover-letter.md', screening: 'screening.md', plan: 'plan.md', clientQuestions: 'client-questions.md' } }),
      );
      return view;
    };
    const project = async (id: string, agreement: unknown) => {
      const response = await inject('POST', `/api/upwork/applications/${id}/project`, { agreement });
      if (response.statusCode === 201) opened.push((response.json() as { id: string }).id);
      return response;
    };

    it('only a won application → UPWORK_003; an agreement over 20 000 or not text → 400', async () => {
      const view = await won();
      expect((await project(view.id, 'Acordo')).json()).toMatchObject({ errorCode: 'UPWORK_003' });
      await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'won' });
      for (const agreement of ['x'.repeat(20_001), 42]) expect((await project(view.id, agreement)).statusCode).toBe(400);
    });

    it('the agreement is optional: blank or absent → null, and the brief carries the questions and the notes', async () => {
      const view = await won();
      await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'won', notes: 'NOTAS: o cliente paga por milestone.' });
      const response = await project(view.id, '   ');
      expect(response.statusCode).toBe(201);
      const brief = readFileSync(join(dataDir, GUIDED_FILES.dir, (response.json() as { id: string }).id, 'brief.md'), 'utf8');
      const order = ['Um painel de entregas.', 'CARTA:', 'PLANO:', 'PERGUNTAS:', 'Conversa da candidatura', 'NOTAS:', 'nenhum acordo colado'].map((part) => brief.indexOf(part));
      expect(order.every((at) => at >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({ agreement: null });
    });

    it('won: a creation of its own starts in Novo projeto, from the brief — post, letter, plan, agreement, in this order', async () => {
      const view = await won();
      await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'won' });
      const response = await project(view.id, 'ACORDO: 3 milestones, entrega a 15 de novembro.');
      expect(response.statusCode).toBe(201);
      const creation = response.json() as { id: string; purpose: string };
      expect(creation.purpose).toBe('create');
      expect((await inject('GET', '/api/creations/current')).json()).toMatchObject({ id: creation.id });

      const brief = readFileSync(join(dataDir, GUIDED_FILES.dir, creation.id, 'brief.md'), 'utf8');
      const order = ['Um painel de entregas.', 'CARTA:', 'PLANO:', 'ACORDO:'].map((part) => brief.indexOf(part));
      expect(order.every((at) => at >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(brief).toContain('Acme dashboard');
      expect(claude.launches.at(-1)!.args!.at(-1)).toBe(`/create --app ${join(dataDir, GUIDED_FILES.dir, creation.id, 'brief.md')}`);

      const read = (await inject('GET', `/api/upwork/applications/${view.id}`)).json();
      expect(read).toMatchObject({ agreement: 'ACORDO: 3 milestones, entrega a 15 de novembro.', creationGuidedId: creation.id, projectPath: null });
      // Another creation open → CREATE_001, and the application is left as it was.
      expect((await project(view.id, 'outro')).json()).toMatchObject({ errorCode: 'CREATE_001' });
      expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({ creationGuidedId: creation.id });
    });

    it('when the creation ends with a project, the application takes its path — and keeps it after the creation is closed', async () => {
      const view = await won();
      await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'won' });
      const creation = (await project(view.id, 'Acordo')).json() as { id: string };
      const projectPath = join(root, 'projetos', 'Acme');
      writeFileSync(join(dataDir, GUIDED_FILES.dir, creation.id, 'result.json'), JSON.stringify({ version: 1, status: 'done', projectPath, projectName: 'Acme', summary: '' }));
      expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({ projectPath });
      await app.inject({ method: 'DELETE', url: `/api/guided/${creation.id}`, headers: { cookie } });
      opened.splice(opened.indexOf(creation.id), 1);
      expect(((await inject('GET', '/api/upwork/applications')).json() as { id: string; projectPath: string }[]).find((v) => v.id === view.id)).toMatchObject({ projectPath });
    });

    it('the post survives archiving: a won, archived application cannot start a project (UPWORK_004), and job.md stays with the record', async () => {
      const view = await won('Anúncio que fica');
      await inject('PATCH', `/api/upwork/applications/${view.id}`, { status: 'won' });
      await inject('POST', `/api/upwork/applications/${view.id}/archive`);
      opened.splice(opened.indexOf(view.guidedId), 1);
      expect(readFileSync(join(dataDir, UPWORK_FILES.dir, UPWORK_FILES.applications, view.id, UPWORK_FILES.job), 'utf8')).toBe('Anúncio que fica\n');
      expect((await project(view.id, 'Acordo')).json()).toMatchObject({ errorCode: 'UPWORK_004' });
    });
  });

  it('a session removed by hand leaves the application readable, with guided null', async () => {
    await putProfile('# Quem sou');
    const view = (await apply({ job: 'Job' })).json() as View;
    await app.inject({ method: 'DELETE', url: `/api/guided/${view.guidedId}`, headers: { cookie } });
    expect(existsSync(join(dataDir, GUIDED_FILES.dir, view.guidedId))).toBe(false);
    expect((await inject('GET', `/api/upwork/applications/${view.id}`)).json()).toMatchObject({ id: view.id, guided: null });
  });
});
