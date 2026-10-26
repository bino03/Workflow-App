import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError, type ErrorCode } from '../src/common/errors.js';
import { IMPORT_FILES } from '../src/imports/importFiles.js';
import { type CreateImport, type ImportResult, createImportSchema } from '../src/imports/imports.schemas.js';
import { ImportService } from '../src/imports/importService.js';
import type { WorkflowChange } from '../src/imports/workflowGit.js';
import type { CreateImportTerminal, TerminalStatus } from '../src/terminals/terminalsService.js';

let base: string;
let dataDir: string;
let workflow: string;
let project: string;
let outside: string;

let launched: CreateImportTerminal[];
let terminalStatus: TerminalStatus | undefined;
let closed: string[];
let revealed: string[];
let changes: WorkflowChange[];
let gitFails: boolean;
let commitFails: boolean;
let commits: { paths: string[]; message: string }[];
let discarded: string[][];
let createFails: AppError | undefined;

function service() {
  return new ImportService({
    dataDir,
    workflowPath: workflow,
    allowedRoots: [join(base, 'root')],
    terminals: {
      createImport: async (request) => {
        if (createFails) throw createFails;
        launched.push(request);
        terminalStatus = 'running';
        return { id: TERMINAL, claudeSessionId: SESSION } as never;
      },
      get: () => (terminalStatus ? ({ status: terminalStatus } as never) : undefined),
      reveal: (id) => {
        revealed.push(id);
        return { id } as never;
      },
      close: async (id) => {
        closed.push(id);
      },
    },
    git: {
      changes: async () => {
        if (gitFails) throw Object.assign(new Error('git failed'), { stderr: 'fatal: not a git repository' });
        return changes;
      },
      diff: async (list) => list.map((change) => ({ ...change, diff: `diff of ${change.path}`, truncated: false })),
      commit: async (list, message) => {
        if (commitFails) throw Object.assign(new Error('commit failed'), { stderr: '✗ A biblioteca tem erros (acima).' });
        commits.push({ paths: list.map((c) => c.path), message });
        return 'abc1234';
      },
      discard: async (list) => {
        discarded.push(list.map((c) => c.path));
      },
    },
  });
}

const TERMINAL = '6b0d1f6e-1d7e-4d5c-9a7c-0e2b8f9c1a11';
const SESSION = '0b9f1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d';

const body = (raw: unknown): CreateImport => createImportSchema.parse(raw);
const textImport = () => body({ kind: 'design', source: { type: 'text', text: 'um tema escuro' }, answers: { name: 'Teste' } });

async function expectAppError(action: () => unknown, code: ErrorCode) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected ${code}`).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

function importDirs(): string[] {
  const dir = join(dataDir, IMPORT_FILES.imports);
  return existsSync(dir) ? readdirSync(dir) : [];
}

function writeResult(id: string, overrides: Partial<ImportResult> = {}) {
  const result: ImportResult = {
    version: 1,
    id,
    status: 'done',
    kind: 'design',
    libraryId: 'teste',
    summary: 'Entrou.',
    triage: [{ criterion: 'Distinto', ok: true, note: '' }],
    commitMessage: 'feat: acrescenta o design teste à biblioteca',
    error: null,
    ...overrides,
  };
  writeFileSync(join(dataDir, IMPORT_FILES.imports, id, 'result.json'), JSON.stringify(result));
}

function writeEvent(event: string) {
  mkdirSync(join(dataDir, IMPORT_FILES.events), { recursive: true });
  writeFileSync(join(dataDir, IMPORT_FILES.events, `${SESSION}.json`), JSON.stringify({ event, at: new Date().toISOString() }));
}

beforeEach(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wfa-imports-')));
  dataDir = join(base, 'data');
  workflow = join(base, 'root', 'Workflow');
  project = join(base, 'root', 'projetos', 'Gestao');
  outside = join(base, 'outside');
  for (const dir of [workflow, project, outside]) mkdirSync(dir, { recursive: true });
  launched = [];
  terminalStatus = undefined;
  closed = [];
  revealed = [];
  changes = [];
  gitFails = false;
  commitFails = false;
  commits = [];
  discarded = [];
  createFails = undefined;
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe('ImportService.create', () => {
  it('text: writes request.json (contract v1) and launches the hidden terminal with the import folder', async () => {
    const view = await service().create(textImport(), []);
    expect(view).toMatchObject({ kind: 'design', sourceLabel: 'Descrição', status: 'running', terminalId: TERMINAL, result: null, error: null });
    const dir = join(dataDir, IMPORT_FILES.imports, view.id);
    const request = JSON.parse(readFileSync(join(dir, 'request.json'), 'utf8'));
    expect(request).toEqual({
      version: 1,
      id: view.id,
      kind: 'design',
      source: { type: 'text', text: 'um tema escuro' },
      answers: { name: 'Teste', character: '', suits: '', notSuits: '' },
      createdAt: view.createdAt,
    });
    expect(launched).toEqual([{ importId: view.id, cwd: workflow, requestPath: join(dir, 'request.json'), addDirs: [dir], cols: 120, rows: 40 }]);
  });

  it('files: stages them under files/ with their relative paths and points the request there', async () => {
    const view = await service().create(
      body({ kind: 'auto', source: { type: 'files', paths: ['handoff/README.md', 'handoff/tokens.css'] } }),
      [
        { path: '', data: Buffer.from('# Handoff') },
        { path: '', data: Buffer.from(':root{}') },
      ],
    );
    const dir = join(dataDir, IMPORT_FILES.imports, view.id);
    expect(readFileSync(join(dir, 'files', 'handoff', 'README.md'), 'utf8')).toBe('# Handoff');
    expect(JSON.parse(readFileSync(join(dir, 'request.json'), 'utf8')).source).toEqual({ type: 'files', path: join(dir, 'files') });
    expect(view.sourceLabel).toBe('2 ficheiros');
  });

  it('project: resolved inside ALLOWED_ROOTS and added as a second --add-dir; outside → FOLDER_001, nothing left', async () => {
    const view = await service().create(body({ kind: 'stack', source: { type: 'project', path: project } }), []);
    expect(launched[0]!.addDirs).toEqual([join(dataDir, IMPORT_FILES.imports, view.id), project]);
    await service().discard(view.id);

    await expectAppError(() => service().create(body({ kind: 'stack', source: { type: 'project', path: outside } }), []), 'FOLDER_001');
    expect(importDirs()).toEqual([]);
  });

  it('one open import at a time → IMPORT_002, also while the first is still being created', async () => {
    const imports = service();
    const first = imports.create(textImport(), []);
    await expectAppError(() => imports.create(textImport(), []), 'IMPORT_002');
    await first;
    await expectAppError(() => service().create(textImport(), []), 'IMPORT_002');
  });

  it('a Workflow with uncommitted changes → IMPORT_003; git failing → IMPORT_006; nothing created', async () => {
    changes = [{ path: 'docs/x.md', change: 'modified' }];
    await expectAppError(() => service().create(textImport(), []), 'IMPORT_003');
    changes = [];
    gitFails = true;
    await expectAppError(() => service().create(textImport(), []), 'IMPORT_006');
    expect(importDirs()).toEqual([]);
    expect(launched).toEqual([]);
  });

  it('files that do not match source.paths, or a bad path → IMPORT_004; a terminal that cannot start → its error, folder removed', async () => {
    await expectAppError(() => service().create(body({ kind: 'skill', source: { type: 'files', paths: ['a.md', 'b.md'] } }), [{ path: '', data: Buffer.from('a') }]), 'IMPORT_004');
    await expectAppError(() => service().create(textImport(), [{ path: '', data: Buffer.from('a') }]), 'IMPORT_004');
    createFails = new AppError('TERMINAL_007');
    await expectAppError(() => service().create(textImport(), []), 'TERMINAL_007');
    expect(importDirs()).toEqual([]);
  });
});

describe('ImportService status (§4.1)', () => {
  it('running → needs-you on Stop/Notification → running again when the user answers', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    expect((await imports.get(id)).status).toBe('running');
    writeEvent('Stop');
    expect((await imports.get(id)).status).toBe('needs-you');
    writeEvent('UserPromptSubmit');
    expect((await imports.get(id)).status).toBe('running');
    writeEvent('Notification');
    expect((await imports.get(id)).status).toBe('needs-you');
  });

  it('a result decides: review with changes, rejected without, failed as reported; the count comes from git', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    writeEvent('Stop');
    writeResult(id);
    changes = [
      { path: 'library/frontend/themes/teste/THEME.md', change: 'added' },
      { path: 'docs/provenance.md', change: 'modified' },
    ];
    expect(await imports.get(id)).toMatchObject({ status: 'review', changedFiles: 2, result: { libraryId: 'teste' } });

    writeResult(id, { status: 'rejected', libraryId: null });
    expect((await imports.get(id)).status).toBe('review'); // the discard record in provenance.md is a change to review
    changes = [];
    expect(await imports.get(id)).toMatchObject({ status: 'rejected', changedFiles: 0 });

    writeResult(id, { status: 'failed', error: 'URL inacessível' });
    expect(await imports.get(id)).toMatchObject({ status: 'failed', error: 'URL inacessível' });

    writeResult(id, { status: 'done' });
    expect((await imports.get(id)).status).toBe('failed'); // says it wrote, but nothing changed
  });

  it('an invalid result.json, or one for another import → failed; a terminal that ended without a result → failed', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    writeFileSync(join(dataDir, IMPORT_FILES.imports, id, 'result.json'), '{"version":2}');
    expect(await imports.get(id)).toMatchObject({ status: 'failed', error: expect.stringMatching(/^result.json inválido: version/), result: null });
    writeResult(id, { id: randomUUID() });
    expect((await imports.get(id)).error).toBe('result.json inválido: id de outra importação');

    rmSync(join(dataDir, IMPORT_FILES.imports, id, 'result.json'));
    terminalStatus = 'exited';
    expect(await imports.get(id)).toMatchObject({ status: 'failed', error: 'o terminal terminou sem resultado' });
    terminalStatus = undefined; // after a backend restart the terminal is gone from memory
    expect((await imports.get(id)).status).toBe('failed');
  });

  it('current(): null without an import; a folder without meta.json (a create that died) is not one', async () => {
    const imports = service();
    expect(await imports.current()).toBeNull();
    mkdirSync(join(dataDir, IMPORT_FILES.imports, randomUUID()), { recursive: true });
    expect(await imports.current()).toBeNull();
    const view = await imports.create(textImport(), []);
    expect((await imports.current())?.id).toBe(view.id);
  });
});

describe('ImportService reveal / review / discard', () => {
  it('reveal shows its terminal; discard (also a running one) closes it, restores the Workflow and forgets the import', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    writeEvent('Stop');
    imports.reveal(id);
    expect(revealed).toEqual([TERMINAL]);

    changes = [{ path: 'library/frontend/themes/teste/THEME.md', change: 'added' }];
    await imports.discard(id);
    expect(closed).toEqual([TERMINAL]);
    expect(discarded).toEqual([['library/frontend/themes/teste/THEME.md']]);
    expect(importDirs()).toEqual([]);
    expect(existsSync(join(dataDir, IMPORT_FILES.events, `${SESSION}.json`))).toBe(false);
    expect(await imports.current()).toBeNull();
  });

  it('diff and accept only in review → IMPORT_005 otherwise', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    await expectAppError(() => imports.diff(id), 'IMPORT_005');
    await expectAppError(() => imports.accept(id), 'IMPORT_005');
    writeResult(id, { status: 'rejected', libraryId: null });
    await expectAppError(() => imports.accept(id), 'IMPORT_005'); // rejected, nothing changed
    expect(commits).toEqual([]);
  });

  it('accept commits exactly the changed paths with the skill message, then forgets the import', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    writeResult(id);
    changes = [
      { path: 'library/frontend/themes/teste/THEME.md', change: 'added' },
      { path: 'docs/provenance.md', change: 'modified' },
    ];
    expect((await imports.diff(id)).files.map((f) => f.diff)).toEqual(['diff of library/frontend/themes/teste/THEME.md', 'diff of docs/provenance.md']);
    expect(await imports.accept(id)).toEqual({ commit: 'abc1234' });
    expect(commits).toEqual([
      { paths: ['library/frontend/themes/teste/THEME.md', 'docs/provenance.md'], message: 'feat: acrescenta o design teste à biblioteca' },
    ]);
    expect(closed).toEqual([TERMINAL]);
    expect(importDirs()).toEqual([]);
  });

  it('a commit message that is not one proper line is replaced by the backend one', async () => {
    for (const commitMessage of ['feat: two\nlines', 'acrescenta sem prefixo', `feat: ${'x'.repeat(101)}`, 'feat: x; $(rm)\r']) {
      const imports = service();
      const { id } = await imports.create(textImport(), []);
      writeResult(id, { commitMessage });
      changes = [{ path: 'docs/provenance.md', change: 'modified' }];
      await imports.accept(id);
      expect(commits.at(-1)!.message).toBe('feat: importa design teste para a biblioteca');
      changes = [];
    }
  });

  it('a refused commit (the Workflow pre-commit) → IMPORT_006 with the end of stderr; the import stays open', async () => {
    const imports = service();
    const { id } = await imports.create(textImport(), []);
    writeResult(id);
    changes = [{ path: 'docs/provenance.md', change: 'modified' }];
    commitFails = true;
    let caught: unknown;
    try {
      await imports.accept(id);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: 'IMPORT_006', message: expect.stringContaining('A biblioteca tem erros') });
    expect((await imports.get(id)).status).toBe('review');
    expect(closed).toEqual([]);
  });

  it('an unknown id, or one that is not a UUID, → IMPORT_001', async () => {
    const imports = service();
    await expectAppError(() => imports.get(randomUUID()), 'IMPORT_001');
    await expectAppError(() => imports.discard('../../state'), 'IMPORT_001');
    expect(() => imports.reveal('nope')).toThrow(AppError);
  });
});
