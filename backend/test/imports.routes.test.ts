import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { IMPORT_FILES } from '../src/imports/importFiles.js';
import { claudeJsonPath } from '../src/sessions/claudeTrust.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { fakeClaude } from './fakeClaude.js';
import { TEST_USERNAME, removeDir, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'imports routes password';

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-import-routes-')));
const root = join(base, 'root');
const workflow = join(root, 'Workflow');
const project = join(root, 'projetos', 'Gestao');
const claudeConfig = join(base, 'claude');
const dataDir = join(base, 'data');
for (const dir of [workflow, project, claudeConfig]) mkdirSync(dir, { recursive: true });
// The Workflow is a clean git repository that Claude Code already trusts.
const git = (...args: string[]) => execFileSync('git', args, { cwd: workflow, windowsHide: true });
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'test');
writeFileSync(join(workflow, 'README.md'), '# Workflow\n');
git('add', '.');
git('commit', '-q', '-m', 'base');
writeFileSync(claudeJsonPath(claudeConfig), JSON.stringify({ projects: { [workflow.replace(/\\/g, '/')]: { hasTrustDialogAccepted: true } } }));

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});
afterAll(() => removeDir(base));

type Part = { name: string; value: string | Buffer; filename?: string };

/** A multipart/form-data body by hand — the shape the browser's FormData sends. */
function multipart(parts: Part[]) {
  const boundary = '----wfa-test-boundary';
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = `form-data; name="${part.name}"${part.filename === undefined ? '' : `; filename="${part.filename}"`}`;
    const type = part.filename === undefined ? '' : 'Content-Type: application/octet-stream\r\n';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disposition}\r\n${type}\r\n`), Buffer.from(part.value), Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const requestPart = (request: object): Part => ({ name: 'request', value: JSON.stringify(request) });
const filePart = (filename: string, value: string | Buffer): Part => ({ name: 'files', value, filename });

describe('/api/library/imports', () => {
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
    const terminalManager = new TerminalManager({ spawn: claude.spawn, maxTerminals: 2, scrollbackBytes: 64 * 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    const current = await app.inject({ method: 'GET', url: '/api/library/imports/current', headers: { cookie } });
    const open = current.json() as { id: string } | null;
    if (open) await app.inject({ method: 'DELETE', url: `/api/library/imports/${open.id}`, headers: { cookie } });
  });

  const post = (parts: Part[]) => {
    const { payload, headers } = multipart(parts);
    return app.inject({ method: 'POST', url: '/api/library/imports', payload, headers: { ...headers, cookie } });
  };

  it('needs a session', async () => {
    const { payload, headers } = multipart([requestPart({ kind: 'auto', source: { type: 'text', text: 'x' } })]);
    expect((await app.inject({ method: 'POST', url: '/api/library/imports', payload, headers })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/library/imports/current' })).statusCode).toBe(401);
  });

  it('files: 201 running; the files are staged and claude got --add-dir, the imports settings and /import last', async () => {
    const response = await post([
      requestPart({ kind: 'design', source: { type: 'files', paths: ['handoff/README.md', 'handoff/tokens.css'] }, answers: { name: 'Teste' } }),
      filePart('README.md', '# Handoff'),
      filePart('tokens.css', ':root{}'),
    ]);
    expect(response.statusCode).toBe(201);
    const view = response.json() as { id: string; status: string; terminalId: string; sourceLabel: string };
    expect(view).toMatchObject({ status: 'running', sourceLabel: '2 ficheiros' });

    const dir = join(dataDir, IMPORT_FILES.imports, view.id);
    expect(readFileSync(join(dir, 'files', 'handoff', 'tokens.css'), 'utf8')).toBe(':root{}');
    const args = claude.launches.at(-1)!.args!;
    expect(args.slice(0, 2)).toEqual(['--add-dir', dir]);
    expect(args).toContain(join(dataDir, IMPORT_FILES.settings));
    expect(args.at(-1)).toBe(`/import ${join(dir, 'request.json')}`);
    expect(claude.launches.at(-1)!.cwd).toBe(workflow);

    // Hidden: not in the grid's list.
    const terminals = (await app.inject({ method: 'GET', url: '/api/terminals', headers: { cookie } })).json() as { id: string }[];
    expect(terminals.map((t) => t.id)).not.toContain(view.terminalId);
    expect(((await app.inject({ method: 'GET', url: '/api/library/imports/current', headers: { cookie } })).json() as { id: string }).id).toBe(view.id);
  });

  it('url, project and text sources; a second import while one is open → 409 IMPORT_002', async () => {
    const url = await post([requestPart({ kind: 'skill', source: { type: 'url', url: 'https://skills.sh/x' }, answers: { target: 'process' } })]);
    expect(url.statusCode).toBe(201);
    const again = await post([requestPart({ kind: 'auto', source: { type: 'text', text: 'outra' } })]);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ errorCode: 'IMPORT_002' });
    await app.inject({ method: 'DELETE', url: `/api/library/imports/${(url.json() as { id: string }).id}`, headers: { cookie } });

    const fromProject = await post([requestPart({ kind: 'stack', source: { type: 'project', path: project }, answers: { layer: 'backend' } })]);
    expect(fromProject.statusCode).toBe(201);
    expect(claude.launches.at(-1)!.args!.slice(0, 3)).toEqual(['--add-dir', join(dataDir, IMPORT_FILES.imports, (fromProject.json() as { id: string }).id), project]);
  });

  it('bad input never creates anything: 400 for a path escape, an http(s)-less URL, bad answers, no request field, too many files', async () => {
    const cases: [Part[], number, string][] = [
      [[requestPart({ kind: 'skill', source: { type: 'files', paths: ['../x.md'] } }), filePart('x.md', 'x')], 400, 'COMMON_001'],
      [[requestPart({ kind: 'skill', source: { type: 'url', url: 'file:///C:/Windows/win.ini' } })], 400, 'COMMON_001'],
      [[requestPart({ kind: 'stack', source: { type: 'text', text: 'x' }, answers: { layer: 'kernel' } })], 400, 'COMMON_001'],
      [[requestPart({ kind: 'design', source: { type: 'text', text: 'x' }, answers: { rm: 'x' } })], 400, 'COMMON_001'],
      [[filePart('x.md', 'x')], 400, 'COMMON_001'],
      [[{ name: 'request', value: 'not json' }], 400, 'COMMON_001'],
      [[requestPart({ kind: 'skill', source: { type: 'files', paths: ['a.md', 'b.md'] } }), filePart('a.md', 'a')], 400, 'IMPORT_004'],
      [[requestPart({ kind: 'skill', source: { type: 'files', paths: ['con.md'] } }), filePart('con.md', 'a')], 400, 'IMPORT_004'],
      [
        [requestPart({ kind: 'auto', source: { type: 'files', paths: Array.from({ length: 200 }, (_, i) => `f${i}.md`) } }), ...Array.from({ length: 201 }, (_, i) => filePart(`f${i}.md`, 'x'))],
        400,
        'IMPORT_004',
      ],
      [[requestPart({ kind: 'stack', source: { type: 'project', path: base } })], 403, 'FOLDER_001'],
    ];
    for (const [parts, status, errorCode] of cases) {
      const response = await post(parts);
      expect({ status: response.statusCode, body: response.json() }).toMatchObject({ status, body: { errorCode } });
    }
    expect(existsSync(join(dataDir, IMPORT_FILES.imports)) ? readdirSync(join(dataDir, IMPORT_FILES.imports)) : []).toEqual([]);
    const json = await app.inject({ method: 'POST', url: '/api/library/imports', headers: { cookie }, payload: { kind: 'auto' } });
    expect(json.statusCode).toBe(400);
  });

  it('a Workflow with uncommitted changes → 409 IMPORT_003', async () => {
    writeFileSync(join(workflow, 'dirty.md'), 'x');
    try {
      const response = await post([requestPart({ kind: 'auto', source: { type: 'text', text: 'x' } })]);
      expect(response.json()).toMatchObject({ errorCode: 'IMPORT_003' });
    } finally {
      execFileSync('git', ['clean', '-fq', '--', 'dirty.md'], { cwd: workflow, windowsHide: true });
    }
  });

  it('reveal puts the terminal in the list; DELETE closes it and the import is gone; unknown ids → 404 IMPORT_001', async () => {
    const created = (await post([requestPart({ kind: 'auto', source: { type: 'text', text: 'x' } })])).json() as { id: string; terminalId: string };
    const revealed = await app.inject({ method: 'POST', url: `/api/library/imports/${created.id}/reveal`, headers: { cookie } });
    expect(revealed.json()).toMatchObject({ id: created.terminalId, hidden: false });
    const terminals = (await app.inject({ method: 'GET', url: '/api/terminals', headers: { cookie } })).json() as { id: string }[];
    expect(terminals.map((t) => t.id)).toContain(created.terminalId);

    expect((await app.inject({ method: 'DELETE', url: `/api/library/imports/${created.id}`, headers: { cookie } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/library/imports/current', headers: { cookie } })).json()).toBeNull();
    const after = (await app.inject({ method: 'GET', url: '/api/terminals', headers: { cookie } })).json() as { id: string }[];
    expect(after.map((t) => t.id)).not.toContain(created.terminalId);

    for (const url of [`/api/library/imports/${created.id}`, '/api/library/imports/..%2F..%2Fstate']) {
      const response = await app.inject({ method: 'DELETE', url, headers: { cookie } });
      expect(response.json()).toMatchObject({ errorCode: 'IMPORT_001' });
    }
  });

  /** What /import leaves: a theme folder and a registry line in the Workflow, and result.json next to the request. */
  function skillFinished(id: string) {
    mkdirSync(join(workflow, 'library', 'frontend', 'themes', 'teste'), { recursive: true });
    writeFileSync(join(workflow, 'library', 'frontend', 'themes', 'teste', 'THEME.md'), '---\nid: teste\n---\n');
    writeFileSync(join(workflow, 'README.md'), '# Workflow\n\n| teste |\n');
    writeFileSync(
      join(dataDir, IMPORT_FILES.imports, id, 'result.json'),
      JSON.stringify({
        version: 1,
        id,
        status: 'done',
        kind: 'design',
        libraryId: 'teste',
        summary: 'Entrou o design teste.',
        triage: [{ criterion: 'Distinto', ok: true, note: '' }],
        commitMessage: 'feat: acrescenta o design teste à biblioteca (draft)',
      }),
    );
  }
  const gitOut = (...args: string[]) => execFileSync('git', args, { cwd: workflow, windowsHide: true }).toString().trim();

  it('review → diff → accept: one commit in the Workflow with exactly the import files, and the import is gone', async () => {
    const created = (await post([requestPart({ kind: 'design', source: { type: 'text', text: 'x' } })])).json() as { id: string };
    const early = await app.inject({ method: 'POST', url: `/api/library/imports/${created.id}/accept`, headers: { cookie } });
    expect(early.json()).toMatchObject({ errorCode: 'IMPORT_005' });

    skillFinished(created.id);
    const current = (await app.inject({ method: 'GET', url: '/api/library/imports/current', headers: { cookie } })).json();
    expect(current).toMatchObject({ status: 'review', changedFiles: 2, result: { libraryId: 'teste' } });

    const diff = (await app.inject({ method: 'GET', url: `/api/library/imports/${created.id}/diff`, headers: { cookie } })).json() as {
      files: { path: string; change: string; diff: string }[];
    };
    expect(diff.files.map((f) => `${f.change} ${f.path}`).sort()).toEqual(['added library/frontend/themes/teste/THEME.md', 'modified README.md']);
    expect(diff.files.find((f) => f.path === 'README.md')!.diff).toContain('+| teste |');

    const accepted = await app.inject({ method: 'POST', url: `/api/library/imports/${created.id}/accept`, headers: { cookie } });
    expect(accepted.statusCode).toBe(200);
    const { commit } = accepted.json() as { commit: string };
    expect(gitOut('rev-parse', 'HEAD')).toBe(commit);
    expect(gitOut('log', '-1', '--format=%s')).toBe('feat: acrescenta o design teste à biblioteca (draft)');
    expect(gitOut('show', '--name-only', '--format=', 'HEAD').split(/\r?\n/).sort()).toEqual(['README.md', 'library/frontend/themes/teste/THEME.md']);
    expect(gitOut('status', '--porcelain')).toBe('');
    expect((await app.inject({ method: 'GET', url: '/api/library/imports/current', headers: { cookie } })).json()).toBeNull();
    // Back to the base for the next test.
    execFileSync('git', ['reset', '-q', '--hard', 'HEAD~1'], { cwd: workflow, windowsHide: true });
  });

  it('discard after the skill wrote: the Workflow is exactly as before, new folders included', async () => {
    const head = gitOut('rev-parse', 'HEAD');
    const created = (await post([requestPart({ kind: 'design', source: { type: 'text', text: 'x' } })])).json() as { id: string };
    skillFinished(created.id);
    const response = await app.inject({ method: 'POST', url: `/api/library/imports/${created.id}/discard`, headers: { cookie } });
    expect(response.statusCode).toBe(204);
    expect(gitOut('status', '--porcelain', '--untracked-files=all')).toBe('');
    expect(gitOut('rev-parse', 'HEAD')).toBe(head);
    expect(existsSync(join(workflow, 'library'))).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/library/imports/current', headers: { cookie } })).json()).toBeNull();
  });
});
