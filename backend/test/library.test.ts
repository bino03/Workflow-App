import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/common/errors.js';
import { LibraryService } from '../src/library/libraryService.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME as USERNAME, testConfig } from './helpers.js';

const PASSWORD = 'library test password';

let workflow: string;
let passwordHash: string;

function write(relativePath: string, content: string): void {
  const file = join(workflow, 'library', relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

beforeAll(async () => {
  workflow = mkdtempSync(join(tmpdir(), 'wfa-library-'));
  // Shapes copied from the real Workflow manifests (inline maps, lists, CRLF, comments).
  write(
    'stacks/react-vite-antd/STACK.md',
    [
      '---',
      'kind: stack-doc',
      'id: react-vite-antd',
      'name: React + Vite + Ant Design',
      'layer: frontend',
      'maturity: proven',
      'versions: { react: "18 (Worksite) / 19", vite: "7 / 8", antd: "5" }',
      'pairs-with: [spring-boot, supabase]',
      'provides-skills: [frontend-design-system]',
      'updated: 2026-09-27',
      '---',
      '',
      '# Body is ignored',
    ].join('\r\n'),
  );
  write('stacks/tauri/STACK.md', '---\nkind: stack-doc\nid: tauri\nname: Tauri\nlayer: desktop\nmaturity: planned # not built yet\n---\n');
  write('stacks/broken/STACK.md', '---\nkind: stack-doc\nid: broken\nname: Broken\nlayer: backend\nmaturity: someday\n---\n');
  write('stacks/nofront/STACK.md', '# No frontmatter here\n');
  write('stacks/_TEMPLATE/STACK.md', '---\nkind: stack-doc\nid: "{{ID}}"\n---\n');
  write('stacks/spring-boot/skills/skill-backend-crud.md', '---\nkind: skill\nname: backend-crud\ncategory: backend\nstatus: adapted\ndescription: CRUD for {{PROJECT_NAME}}\n---\n');
  write('frontend/themes/industry/THEME.md', '---\nkind: theme\nid: industry\nname: Industry\nmode: light\ndensity: dense\nstatus: proven\nfonts: [Barlow]\n---\n');
  write('frontend/themes/_TEMPLATE/THEME.md', '---\nkind: theme\n---\n');
  write('skills/process/skill-refine-idea.md', '---\nkind: skill\nname: refine-idea\ncategory: process\nstatus: prospective\napplies-when: always\ndescription: Turn an idea into a ToDo entry\n---\n');
  write('skills/process/README.md', '# not a skill\n');
  write('skills/agents/architect.md', '---\nname: architect\nmodel: opus\n---\n');
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => {
  rmSync(workflow, { recursive: true, force: true });
});

describe('LibraryService', () => {
  const service = () => new LibraryService(workflow);

  it('reads stacks, skipping _TEMPLATE, and lists broken manifests as invalid', async () => {
    const { entries, invalid } = await service().stacks();
    expect(entries.map((s) => s.id)).toEqual(['react-vite-antd', 'tauri']);
    expect(entries[0]).toMatchObject({
      name: 'React + Vite + Ant Design',
      layer: 'frontend',
      maturity: 'proven',
      maturityRaw: 'proven',
      technologies: ['react', 'vite', 'antd'],
      pairsWith: ['spring-boot', 'supabase'],
      providesSkills: ['frontend-design-system'],
      updated: '2026-09-27',
    });
    expect(entries[1]).toMatchObject({ maturity: 'draft', maturityRaw: 'planned', technologies: [], updated: null });
    expect(invalid).toHaveLength(2);
    expect(invalid.map((i) => i.message).join('\n')).toMatch(/broken.*maturity/);
    expect(invalid.map((i) => i.message).join('\n')).toMatch(/nofront.*no frontmatter/);
  });

  it('reads themes', async () => {
    const { entries, invalid } = await service().themes();
    expect(invalid).toEqual([]);
    expect(entries).toEqual([
      expect.objectContaining({ id: 'industry', mode: 'light', density: 'dense', maturity: 'proven', fonts: ['Barlow'] }),
    ]);
  });

  it('reads process and stack skills; ignores agents and READMEs; keeps placeholders raw', async () => {
    const { entries, invalid } = await service().skills();
    expect(invalid).toEqual([]);
    expect(entries.map((s) => s.name)).toEqual(['backend-crud', 'refine-idea']);
    expect(entries[0]).toMatchObject({ stack: 'spring-boot', maturity: 'partial', maturityRaw: 'adapted', description: 'CRUD for {{PROJECT_NAME}}' });
    expect(entries[1]).toMatchObject({ stack: null, category: 'process', appliesWhen: 'always', maturity: 'draft' });
  });

  it('missing library folder → LIBRARY_001', async () => {
    const error = await new LibraryService(join(workflow, 'nope')).stacks().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('LIBRARY_001');
  });
});

describe('GET /api/library/*', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = testConfig({ WORKFLOW_PATH: workflow, APP_PASSWORD_HASH: passwordHash });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    app = await buildApp({ config, terminalManager, logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['stacks', 'themes', 'skills'])('/api/library/%s without a session → 401', async (kind) => {
    const res = await app.inject({ method: 'GET', url: `/api/library/${kind}` });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('AUTH_002');
  });

  it('with a session → 200 {entries, invalid}', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: USERNAME, password: PASSWORD } });
    const cookie = login.cookies.find((c) => c.name === 'session');
    if (!cookie) throw new Error('no session cookie');
    const res = await app.inject({ method: 'GET', url: '/api/library/stacks', headers: { cookie: `session=${cookie.value}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.invalid).toHaveLength(2);
  });
});
