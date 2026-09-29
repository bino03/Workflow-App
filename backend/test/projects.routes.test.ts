import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ProjectsService } from '../src/projects/projectsService.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME as USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'projects test password';

let base: string;
let root: string; // the only ALLOWED_ROOTS entry
let workflow: string; // WORKFLOW_PATH
let passwordHash: string;

function indexMd(): string {
  return [
    '# Registo',
    '',
    `Pasta base: \`${base}\``,
    '',
    '| Projeto | Caminho (relativo à base) | Tipo | Stack (resumo) | Entrada | Vault | Estado |',
    '|---|---|---|---|---|---|---|',
    `| **Dentro** | \`${join('root', 'projA')}\` | meu | Node | \`CLAUDE.md\` | ✅ | ativo |`,
    `| **Fora da raiz** | \`elsewhere\` | meu | Node | \`CLAUDE.md\` | ✅ | ativo |`,
    `| **Descartado** | \`${join('root', 'projA')}\` | meu | Node | \`CLAUDE.md\` | ✅ | descartado (2026-09-06) |`,
    `| **Não existe** | \`${join('root', 'missing')}\` | meu | Node | \`CLAUDE.md\` | ✅ | ativo |`,
    '',
  ].join('\n');
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'wfa-projects-'));
  root = join(base, 'root');
  workflow = join(base, 'workflow');
  mkdirSync(join(root, 'projA'), { recursive: true });
  mkdirSync(join(base, 'elsewhere'), { recursive: true });
  mkdirSync(join(workflow, 'projects'), { recursive: true });
  writeFileSync(join(workflow, 'projects', 'INDEX.md'), indexMd());
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('ProjectsService', () => {
  it('hides projects outside ALLOWED_ROOTS, discarded, and missing folders', async () => {
    const entries = await new ProjectsService(workflow, [root]).list();
    expect(entries).toEqual([{ name: 'Dentro', path: join(root, 'projA'), type: 'meu', stack: 'Node', status: 'ativo' }]);
  });

  it('missing projects/INDEX.md → [], never throws', async () => {
    const entries = await new ProjectsService(join(base, 'no-workflow-here'), [root]).list();
    expect(entries).toEqual([]);
  });
});

describe('GET /api/projects', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = testConfig({ WORKFLOW_PATH: workflow, ALLOWED_ROOTS: root, APP_PASSWORD_HASH: passwordHash });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('without a session → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_002');
  });

  it('with a session → 200 with only the project inside ALLOWED_ROOTS', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: USERNAME, password: PASSWORD } });
    const cookie = login.cookies.find((c) => c.name === 'session');
    if (!cookie) throw new Error('no session cookie');
    const res = await app.inject({ method: 'GET', url: '/api/projects', headers: { cookie: `session=${cookie.value}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ name: 'Dentro', path: join(root, 'projA'), type: 'meu', stack: 'Node', status: 'ativo' }]);
  });
});
