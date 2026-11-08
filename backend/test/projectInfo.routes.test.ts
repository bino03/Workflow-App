import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { ProjectInfo } from '../src/state/state.schema.js';
import type { StateStore } from '../src/state/stateStore.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'project info test password';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

let base: string;
let root: string;
let workflow: string;
let passwordHash: string;

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'wfa-project-info-'));
  root = join(base, 'root');
  workflow = join(base, 'workflow');
  mkdirSync(join(root, 'worksite'), { recursive: true });
  mkdirSync(join(workflow, 'projects'), { recursive: true });
  writeFileSync(
    join(workflow, 'projects', 'INDEX.md'),
    [
      `Pasta base: \`${base}\``,
      '',
      '| Projeto | Caminho (relativo à base) | Tipo | Stack (resumo) | Entrada | Vault | Estado |',
      '|---|---|---|---|---|---|---|',
      `| **Worksite** | \`${join('root', 'worksite')}\` | meu | Node | \`CLAUDE.md\` | ✅ | ativo |`,
      '',
    ].join('\n'),
  );
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('/api/project-infos (ADR 0028)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let stateStore: StateStore;
  let path: string;

  beforeEach(async () => {
    const config = testConfig({ WORKFLOW_PATH: workflow, ALLOWED_ROOTS: root, APP_PASSWORD_HASH: passwordHash });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    stateStore = await testStateStore();
    app = await buildApp({ stateStore, config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
    const projects = (await call('GET', '/api/projects')).json<{ path: string }[]>();
    path = projects[0]!.path;
  });
  afterEach(async () => {
    await app.close();
  });

  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const query = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;
  const put = (info: object, target = path) => call('PUT', '/api/project-infos', { projectPath: target, info });
  const production = (extra: object = {}) => ({ kind: 'production', name: 'Produção', url: 'https://worksite.example.com', hosting: 'Vercel', ...extra });

  it('needs a session', async () => {
    for (const [method, url] of [
      ['GET', '/api/project-infos'],
      ['PUT', '/api/project-infos'],
      ['DELETE', '/api/project-infos'],
      ['POST', '/api/project-infos/deploys'],
      ['DELETE', '/api/project-infos/deploys'],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json()).toMatchObject({ errorCode: 'AUTH_002' });
    }
  });

  it('starts empty; PUT creates a sheet, gives new environments an id and fills the defaults', async () => {
    expect((await call('GET', '/api/project-infos')).json()).toEqual([]);
    const res = await put({ lifecycle: 'production', environments: [production()] });
    expect(res.statusCode).toBe(200);
    const info = res.json<ProjectInfo>();
    expect(info).toMatchObject({ projectPath: path, lifecycle: 'production', client: null, notes: '', links: [] });
    expect(info.environments[0]).toMatchObject({ name: 'Produção', hosting: 'Vercel', deploys: [] });
    expect(info.environments[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await call('GET', '/api/project-infos')).json()).toEqual([info]);
  });

  it('PUT with nothing filled in still saves, and is idempotent', async () => {
    expect((await put({})).statusCode).toBe(200);
    expect((await put({})).statusCode).toBe(200);
    expect((await call('GET', '/api/project-infos')).json()).toHaveLength(1);
  });

  it('PUT keeps the deploys of an environment that keeps its id and drops those of a removed one', async () => {
    const first = (await put({ environments: [production(), { kind: 'staging', name: 'Staging' }] })).json<ProjectInfo>();
    const [prod, staging] = first.environments;
    await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId: prod!.id, version: 'v1' });
    await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId: staging!.id, version: 'v1' });

    const second = (await put({ environments: [{ ...production({ hosting: 'Netlify' }), id: prod!.id }] })).json<ProjectInfo>();
    expect(second.environments).toHaveLength(1);
    expect(second.environments[0]).toMatchObject({ id: prod!.id, hosting: 'Netlify' });
    expect(second.environments[0]!.deploys).toHaveLength(1);
    expect(second.environments[0]!.deploys[0]).toMatchObject({ version: 'v1' });
  });

  it('refuses a non-http(s) URL, too many environments and a body without a path (COMMON_001)', async () => {
    for (const info of [
      { repoUrl: 'javascript:alert(1)' },
      { environments: [production({ url: 'file:///etc/passwd' })] },
      { environments: Array.from({ length: 6 }, () => production()) },
    ]) {
      const res = await put(info);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ errorCode: 'COMMON_001' });
    }
    expect((await call('PUT', '/api/project-infos', { info: {} })).json()).toMatchObject({ errorCode: 'COMMON_001' });
  });

  it('PROJECT_001 for a path that is not in the registry, on every route', async () => {
    const outside = join(base, 'elsewhere');
    expect(await put({}, outside).then((r) => [r.statusCode, r.json().errorCode])).toEqual([404, 'PROJECT_001']);
    expect((await call('DELETE', `/api/project-infos${query({ projectPath: outside })}`)).json()).toMatchObject({ errorCode: 'PROJECT_001' });
    expect((await call('POST', '/api/project-infos/deploys', { projectPath: outside, environmentId: UNKNOWN })).json()).toMatchObject({ errorCode: 'PROJECT_001' });
    const del = await call('DELETE', `/api/project-infos/deploys${query({ projectPath: outside, environmentId: UNKNOWN, deployId: UNKNOWN })}`);
    expect(del.json()).toMatchObject({ errorCode: 'PROJECT_001' });
  });

  it('registers a deploy: "now" when `at` is missing, newest first, version and note kept', async () => {
    const info = (await put({ environments: [production()] })).json<ProjectInfo>();
    const environmentId = info.environments[0]!.id;
    const before = Date.now();
    const now = await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId });
    expect(now.statusCode).toBe(200);
    const [fresh] = now.json<ProjectInfo>().environments[0]!.deploys;
    expect(Date.parse(fresh!.at)).toBeGreaterThanOrEqual(before - 1000);
    expect(fresh).toMatchObject({ version: null, note: null });

    const old = await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId, at: '2026-01-01T10:00:00.000Z', version: 'v0.9', note: 'primeiro' });
    const deploys = old.json<ProjectInfo>().environments[0]!.deploys;
    expect(deploys.map((d) => d.version)).toEqual([null, 'v0.9']);
    expect(deploys[1]).toMatchObject({ at: '2026-01-01T10:00:00.000Z', note: 'primeiro' });
  });

  it('the 21st deploy pushes the oldest one out', async () => {
    const info = (await put({ environments: [production()] })).json<ProjectInfo>();
    const environmentId = info.environments[0]!.id;
    let last!: ProjectInfo;
    for (let day = 1; day <= 21; day++) {
      const at = new Date(Date.UTC(2026, 0, day)).toISOString();
      last = (await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId, at, version: `v${day}` })).json<ProjectInfo>();
    }
    const deploys = last.environments[0]!.deploys;
    expect(deploys).toHaveLength(20);
    expect(deploys[0]!.version).toBe('v21');
    expect(deploys.at(-1)!.version).toBe('v2');
  });

  it('PROJECT_002 for an unknown environment (or a project without a sheet), PROJECT_003 for an unknown deploy', async () => {
    const noSheet = await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId: UNKNOWN });
    expect([noSheet.statusCode, noSheet.json().errorCode]).toEqual([404, 'PROJECT_002']);
    const info = (await put({ environments: [production()] })).json<ProjectInfo>();
    const environmentId = info.environments[0]!.id;
    expect((await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId: UNKNOWN })).json()).toMatchObject({ errorCode: 'PROJECT_002' });
    const unknownDeploy = await call('DELETE', `/api/project-infos/deploys${query({ projectPath: path, environmentId, deployId: UNKNOWN })}`);
    expect([unknownDeploy.statusCode, unknownDeploy.json().errorCode]).toEqual([404, 'PROJECT_003']);
    const unknownEnv = await call('DELETE', `/api/project-infos/deploys${query({ projectPath: path, environmentId: UNKNOWN, deployId: UNKNOWN })}`);
    expect(unknownEnv.json()).toMatchObject({ errorCode: 'PROJECT_002' });
  });

  it('deletes one deploy, then the whole sheet (204, and again is still 204)', async () => {
    const info = (await put({ environments: [production()] })).json<ProjectInfo>();
    const environmentId = info.environments[0]!.id;
    const withDeploys = (await call('POST', '/api/project-infos/deploys', { projectPath: path, environmentId, version: 'v1' })).json<ProjectInfo>();
    const deployId = withDeploys.environments[0]!.deploys[0]!.id;

    const afterDelete = await call('DELETE', `/api/project-infos/deploys${query({ projectPath: path, environmentId, deployId })}`);
    expect(afterDelete.statusCode).toBe(200);
    expect(afterDelete.json<ProjectInfo>().environments[0]!.deploys).toEqual([]);

    for (let i = 0; i < 2; i++) expect((await call('DELETE', `/api/project-infos${query({ projectPath: path })}`)).statusCode).toBe(204);
    expect((await call('GET', '/api/project-infos')).json()).toEqual([]);
    expect(stateStore.read().projectInfos).toEqual([]);
  });

  it('GET only lists sheets of projects the registry still shows', async () => {
    await put({ lifecycle: 'paused' });
    stateStore.update((draft) => {
      draft.projectInfos.push({ ...draft.projectInfos[0]!, projectPath: join(base, 'gone') });
    });
    const list = (await call('GET', '/api/project-infos')).json<ProjectInfo[]>();
    expect(list.map((info) => info.projectPath)).toEqual([path]);
    expect(stateStore.read().projectInfos).toHaveLength(2);
  });
});
