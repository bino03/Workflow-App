import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME as USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'library upload test password';
const BOUNDARY = '----wfaTestBoundary8f2c';

let workflow: string;
let app: FastifyInstance;
let cookie: string;

const stacksDir = () => join(workflow, 'library', 'stacks');
const skillFile = (folder: string, name: string) => join(stacksDir(), folder, 'skills', `skill-${name}.md`);
const stackMd = (folder: string) => readFileSync(join(stacksDir(), folder, 'STACK.md'), 'utf8');

const skillMd = (name: string, status = 'adapted') =>
  ['---', 'kind: skill', `name: ${name}`, 'category: desktop', `status: ${status}`, 'description: Uma skill de teste', '---', '', '# Corpo'].join('\n');

/** A multipart body with one file part — the shape a browser's FormData sends. */
function multipart(content: string | Buffer, { filename = 'qualquer-nome.md', field = 'file' } = {}) {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: text/markdown\r\n\r\n`,
    ),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

function upload(stackId: string, content: string | Buffer, options?: { filename?: string; field?: string; cookie?: string }) {
  const headers: Record<string, string> = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };
  const sent = options?.cookie ?? cookie;
  if (sent !== '') headers.cookie = sent;
  return app.inject({ method: 'POST', url: `/api/library/stacks/${stackId}/skills`, headers, payload: multipart(content, options) });
}

beforeAll(async () => {
  workflow = mkdtempSync(join(tmpdir(), 'wfa-upload-'));
  const write = (relativePath: string, content: string) => {
    const file = join(workflow, 'library', relativePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  write('stacks/tauri/STACK.md', '---\nkind: stack-doc\nid: tauri\nname: Tauri\nlayer: desktop\nmaturity: planned\nprovides-skills: []\n---\n\n# Tauri\n');
  write('stacks/tauri/skills/skill-ja-existe.md', skillMd('ja-existe'));
  // A stack whose folder name differs from its manifest id: the destination must follow the folder.
  write('stacks/pasta-diferente/STACK.md', '---\nkind: stack-doc\nid: id-diferente\nname: Outra\nlayer: backend\nmaturity: partial\nprovides-skills: [uma]\n---\n');

  const config = testConfig({ WORKFLOW_PATH: workflow, APP_PASSWORD_HASH: await argon2.hash(PASSWORD, { type: argon2.argon2id }) });
  const terminalManager = new TerminalManager({
    spawn: () => {
      throw new Error('no spawn');
    },
    maxTerminals: 1,
    scrollbackBytes: 1024,
  });
  app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });

  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: USERNAME, password: PASSWORD } });
  const session = login.cookies.find((c) => c.name === 'session');
  if (!session) throw new Error('no session cookie');
  cookie = `session=${session.value}`;
});

afterAll(async () => {
  await app.close();
  rmSync(workflow, { recursive: true, force: true });
});

describe('POST /api/library/stacks/:stackId/skills', () => {
  it('writes the skill, names the file from the frontmatter, and updates provides-skills', async () => {
    const res = await upload('tauri', skillMd('nova-coisa'), { filename: 'nome-do-cliente-ignorado.md' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'nova-coisa',
      category: 'desktop',
      stack: 'tauri',
      maturity: 'partial',
      maturityRaw: 'adapted',
      description: 'Uma skill de teste',
      path: skillFile('tauri', 'nova-coisa'),
    });
    expect(readFileSync(skillFile('tauri', 'nova-coisa'), 'utf8')).toBe(skillMd('nova-coisa'));
    expect(stackMd('tauri')).toContain('provides-skills: [nova-coisa]');
    expect(stackMd('tauri')).toContain('# Tauri');
  });

  it('follows the folder on disk, not the manifest id, when the two differ', async () => {
    const res = await upload('id-diferente', skillMd('outra-coisa'));
    expect(res.statusCode).toBe(201);
    expect(res.json().stack).toBe('pasta-diferente');
    expect(existsSync(skillFile('pasta-diferente', 'outra-coisa'))).toBe(true);
    expect(stackMd('pasta-diferente')).toContain('provides-skills: [uma, outra-coisa]');
  });

  it('a name already in that stack → 409, and the file on disk is untouched', async () => {
    const before = readFileSync(skillFile('tauri', 'ja-existe'), 'utf8');
    const res = await upload('tauri', skillMd('ja-existe', 'proven'));
    expect(res.statusCode).toBe(409);
    expect(res.json().errorCode).toBe('LIBRARY_003');
    expect(readFileSync(skillFile('tauri', 'ja-existe'), 'utf8')).toBe(before);
  });

  it.each([
    ['sem bloco de frontmatter', '# Só corpo\n'],
    ['kind errado', '---\nkind: stack-doc\nname: mau\ncategory: x\nstatus: adapted\n---\n'],
    ['status desconhecido', '---\nkind: skill\nname: mau\ncategory: x\nstatus: inventado\n---\n'],
    ['YAML inválido', '---\nkind: skill\nname: [mau\n---\n'],
  ])('invalid file (%s) → 400 LIBRARY_002 with fieldErrors, nothing written', async (_label, content) => {
    const res = await upload('tauri', content);
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('LIBRARY_002');
    expect(res.json().fieldErrors.length).toBeGreaterThan(0);
    expect(readdirSync(join(stacksDir(), 'tauri', 'skills')).sort()).toEqual(['skill-ja-existe.md', 'skill-nova-coisa.md']);
  });

  it.each(['Nome Maiusculo', 'nome_com_underscore', 'Nome-Misto', '../fora'])(
    'name %j is not kebab-case → 400 LIBRARY_002',
    async (name) => {
      const res = await upload('tauri', `---\nkind: skill\nname: "${name}"\ncategory: x\nstatus: adapted\n---\n`);
      expect(res.statusCode).toBe(400);
      expect(res.json().errorCode).toBe('LIBRARY_002');
    },
  );

  it('a bare `..` segment never reaches the route — the router collapses the path first', async () => {
    const res = await upload('..', skillMd('traversal'));
    expect(res.statusCode).toBe(404);
    expect(res.json().errorCode).toBe('COMMON_003');
    expect(readdirSync(stacksDir()).sort()).toEqual(['pasta-diferente', 'tauri']);
  });

  it.each(['nao-existe', '..%2F..%2Fetc', '%2Fetc%2Fpasswd', 'C%3A%5CWindows'])(
    'unknown stackId %j → 404 LIBRARY_004, nothing written anywhere',
    async (stackId) => {
      const res = await upload(stackId, skillMd('traversal'));
      expect(res.statusCode).toBe(404);
      expect(res.json().errorCode).toBe('LIBRARY_004');
      expect(readdirSync(stacksDir()).sort()).toEqual(['pasta-diferente', 'tauri']);
      expect(existsSync(join(workflow, 'library', 'skills'))).toBe(false);
      expect(existsSync(join(workflow, 'skills'))).toBe(false);
    },
  );

  it('empty file → 400 LIBRARY_005', async () => {
    const res = await upload('tauri', '');
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('LIBRARY_005');
  });

  it('file over 256 KiB → 400 LIBRARY_005, nothing written', async () => {
    const res = await upload('tauri', `${skillMd('gigante')}\n${'x'.repeat(256 * 1024)}`);
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('LIBRARY_005');
    expect(existsSync(skillFile('tauri', 'gigante'))).toBe(false);
  });

  it('a file part under another field name → 400 COMMON_001', async () => {
    const res = await upload('tauri', skillMd('campo-errado'), { field: 'ficheiro' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('COMMON_001');
    expect(existsSync(skillFile('tauri', 'campo-errado'))).toBe(false);
  });

  it('a body that is not multipart → 400 COMMON_001', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/library/stacks/tauri/skills', headers: { cookie }, payload: { file: 'nope' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('COMMON_001');
  });

  it('without a session → 401, nothing written', async () => {
    const res = await upload('tauri', skillMd('sem-sessao'), { cookie: '' });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_002');
    expect(existsSync(skillFile('tauri', 'sem-sessao'))).toBe(false);
  });

  it('the uploaded skill shows up in GET /api/library/skills', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/library/skills', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().entries.map((skill: { name: string }) => skill.name)).toContain('nova-coisa');
  });
});
