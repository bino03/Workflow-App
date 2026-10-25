import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { AppError } from '../common/errors.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import { isUuid } from '../sessions/claudeSessions.js';
import type { TerminalsService } from '../terminals/terminalsService.js';
import { IMPORT_FILES, readImportEvent } from './importFiles.js';
import {
  type CreateImport,
  type ImportMeta,
  type ImportRequestFile,
  type ImportResult,
  type ImportView,
  importMetaSchema,
  importResultSchema,
} from './imports.schemas.js';
import { type StagedFile, stagingDir, writeStagedFiles } from './stagingFiles.js';
import type { WorkflowChange } from './workflowGit.js';

/** Nobody sees this terminal until it is revealed; the grid resizes it then. */
const HIDDEN_SIZE = { cols: 120, rows: 40 };

export type ImportServiceDeps = {
  dataDir: string;
  /** The Workflow repository: the import's cwd, and the only repo its review touches. */
  workflowPath: string;
  allowedRoots: readonly string[];
  terminals: Pick<TerminalsService, 'createImport' | 'get' | 'reveal' | 'close'>;
  git: { changes(): Promise<WorkflowChange[]> };
  now?: () => Date;
};

/**
 * The imports' life cycle (ADR 0019). An import **is** its folder, `DATA_DIR/imports/<id>/`: `meta.json` (ours),
 * `request.json` (what /import reads), `files/` (uploads) and `result.json` (what /import writes). The folder
 * exists from create until accept/discard/cancel, and while it exists no other import may start. The status is
 * never stored — it is derived from those files, the terminal and the last hook event.
 */
export class ImportService {
  private readonly now: () => Date;
  private creating = false;

  constructor(private readonly deps: ImportServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  private get importsDir(): string {
    return join(this.deps.dataDir, IMPORT_FILES.imports);
  }

  private dirOf(id: string): string {
    return join(this.importsDir, id);
  }

  async create(body: CreateImport, files: StagedFile[]): Promise<ImportView> {
    // Synchronous check-and-set: two requests at once must not both pass "no open import".
    if (this.creating || this.openMetas().length > 0) throw new AppError('IMPORT_002');
    this.creating = true;
    try {
      return await this.createUnlocked(body, files);
    } finally {
      this.creating = false;
    }
  }

  private async createUnlocked(body: CreateImport, files: StagedFile[]): Promise<ImportView> {
    // The request's own mistakes first: they need no git.
    if (body.source.type === 'files' ? files.length !== body.source.paths.length : files.length > 0) {
      throw new AppError('IMPORT_004');
    }
    const projectPath =
      body.source.type === 'project' ? resolveAllowedPath(body.source.path, this.deps.allowedRoots) : undefined;
    if ((await this.changes()).length > 0) throw new AppError('IMPORT_003');

    const id = randomUUID();
    const dir = this.dirOf(id);
    const createdAt = this.now().toISOString();
    mkdirSync(dir, { recursive: true });
    try {
      if (body.source.type === 'files') {
        const paths = body.source.paths;
        writeStagedFiles(stagingDir(dir), files.map((file, i) => ({ path: paths[i]!, data: file.data })));
      }
      const request: ImportRequestFile = {
        version: 1,
        id,
        kind: body.kind,
        source:
          body.source.type === 'files'
            ? { type: 'files', path: stagingDir(dir) }
            : body.source.type === 'project'
              ? { type: 'project', path: projectPath! }
              : body.source,
        answers: body.answers,
        createdAt,
      };
      const requestPath = join(dir, 'request.json');
      writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);

      const terminal = await this.deps.terminals.createImport({
        importId: id,
        cwd: this.deps.workflowPath,
        requestPath,
        addDirs: projectPath === undefined ? [dir] : [dir, projectPath],
        ...HIDDEN_SIZE,
      });
      const meta: ImportMeta = {
        id,
        kind: body.kind,
        sourceLabel: sourceLabel(body),
        terminalId: terminal.id,
        claudeSessionId: terminal.claudeSessionId,
        createdAt,
      };
      writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      return await this.view(meta);
    } catch (error) {
      // Nothing half-made stays behind: no meta.json means no open import.
      rmSync(dir, { recursive: true, force: true });
      throw error;
    }
  }

  /** The open import (there is at most one), or null. */
  async current(): Promise<ImportView | null> {
    const meta = this.openMetas().at(-1);
    return meta ? this.view(meta) : null;
  }

  async get(id: string): Promise<ImportView> {
    return this.view(this.meta(id));
  }

  /** "Ver terminal": the hidden terminal joins the grid. */
  reveal(id: string) {
    return this.deps.terminals.reveal(this.meta(id).terminalId);
  }

  /** Ends the import: closes its terminal (to the history) and deletes its folder and hook event. */
  async cancel(id: string): Promise<void> {
    const meta = this.meta(id);
    try {
      await this.deps.terminals.close(meta.terminalId);
    } catch (error) {
      // Closed by hand already (it was revealed): the import still has to go.
      if (!(error instanceof AppError && error.code === 'TERMINAL_001')) throw error;
    }
    rmSync(this.dirOf(meta.id), { recursive: true, force: true });
    rmSync(join(this.deps.dataDir, IMPORT_FILES.events, `${meta.claudeSessionId}.json`), { force: true });
  }

  private meta(id: string): ImportMeta {
    const meta = isUuid(id) ? readMeta(this.dirOf(id)) : null;
    if (!meta || meta.id !== id) throw new AppError('IMPORT_001');
    return meta;
  }

  /** Open imports, oldest first. A folder without a valid meta.json (a create that died) is not one. */
  private openMetas(): ImportMeta[] {
    if (!existsSync(this.importsDir)) return [];
    return readdirSync(this.importsDir)
      .filter(isUuid)
      .map((name) => readMeta(this.dirOf(name)))
      .filter((meta): meta is ImportMeta => meta !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private async changes(): Promise<WorkflowChange[]> {
    try {
      return await this.deps.git.changes();
    } catch (error) {
      throw new AppError('IMPORT_006', `git status failed in the Workflow: ${gitMessage(error)}`);
    }
  }

  /** The status, in this order: a result decides; else a terminal that is gone failed; else the last hook event. */
  private async view(meta: ImportMeta): Promise<ImportView> {
    const base = { id: meta.id, kind: meta.kind, sourceLabel: meta.sourceLabel, terminalId: meta.terminalId, createdAt: meta.createdAt };
    const read = readResult(join(this.dirOf(meta.id), 'result.json'));
    if (read !== undefined) {
      if (read === null) return { ...base, status: 'failed', result: null, changedFiles: 0, error: 'result.json inválido' };
      const changedFiles = (await this.changes()).length;
      if (read.status === 'failed') return { ...base, status: 'failed', result: read, changedFiles, error: read.error ?? null };
      if (changedFiles > 0) return { ...base, status: 'review', result: read, changedFiles, error: null };
      if (read.status === 'rejected') return { ...base, status: 'rejected', result: read, changedFiles, error: null };
      return { ...base, status: 'failed', result: read, changedFiles, error: 'a skill disse que escreveu, mas o Workflow não tem alterações' };
    }
    const terminal = this.deps.terminals.get(meta.terminalId);
    if (terminal?.status !== 'running') {
      return { ...base, status: 'failed', result: null, changedFiles: 0, error: 'o terminal terminou sem resultado' };
    }
    const event = readImportEvent(this.deps.dataDir, meta.claudeSessionId)?.event;
    const status = event === 'Stop' || event === 'Notification' ? 'needs-you' : 'running';
    return { ...base, status, result: null, changedFiles: 0, error: null };
  }
}

function readMeta(dir: string): ImportMeta | null {
  try {
    const parsed = importMetaSchema.safeParse(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** undefined = no result yet; null = there is one, but it does not follow the contract. */
function readResult(file: string): ImportResult | null | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const parsed = importResultSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success && parsed.data.id === basename(dirname(file)) ? parsed.data : null;
  } catch {
    return null;
  }
}

function sourceLabel(body: CreateImport): string {
  switch (body.source.type) {
    case 'files': {
      const n = body.source.paths.length;
      return n === 1 ? body.source.paths[0]! : `${n} ficheiros`;
    }
    case 'url':
      return body.source.url;
    case 'project':
      return body.source.path;
    case 'text':
      return 'Descrição';
  }
}

export function gitMessage(error: unknown): string {
  const stderr = (error as { stderr?: unknown })?.stderr;
  const text = typeof stderr === 'string' && stderr.trim() ? stderr : error instanceof Error ? error.message : String(error);
  return text.trim().split(/\r?\n/).slice(-3).join(' · ').slice(0, 300);
}
