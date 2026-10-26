import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from '../common/errors.js';
import { type ClaudeSessions, isUuid } from '../sessions/claudeSessions.js';
import { atomicWrite } from '../state/atomicWrite.js';
import { GUIDED_COMMANDS } from '../terminals/claudeArgs.js';
import type { TerminalsService } from '../terminals/terminalsService.js';
import { GUIDED_EVENTS, GUIDED_FILES, type GuidedEvent } from './guidedFiles.js';
import { type FeedEntry, TranscriptFeed, feedPage } from './transcriptFeed.js';
import {
  type CreateResult,
  type GuidedMeta,
  type GuidedPurpose,
  type GuidedView,
  type PendingFile,
  createResultSchema,
  guidedMetaSchema,
  pendingFileSchema,
} from './guided.schemas.js';

/** Nobody sees this terminal until it is revealed; the grid resizes it then. */
const HIDDEN_SIZE = { cols: 120, rows: 40 };

const PENDING_FILE = /^pending-([0-9a-f-]{36})\.json$/i;

export type GuidedServiceDeps = {
  dataDir: string;
  terminals: Pick<TerminalsService, 'createGuided' | 'get' | 'reveal' | 'close' | 'reopen' | 'paste'>;
  /** Where the session's .jsonl is (ClaudeSessions.fileOf). */
  sessions: Pick<ClaudeSessions, 'fileOf'>;
  feed?: TranscriptFeed;
  /** Whether a hook process is still waiting (its pid); tests replace it. */
  isAlive?: (pid: number) => boolean;
  now?: () => Date;
};

export type StartGuided = {
  purpose: GuidedPurpose;
  /** Where claude runs (WORKFLOW_PATH for `create`). */
  cwd: string;
  /** The content of the purpose's input file (the brief), written by the backend — never on the command line. */
  input: string;
};

/**
 * Guided sessions (ADR 0020): a hidden terminal driven through blocking hooks. A session **is** its folder,
 * `DATA_DIR/guided/<id>/`, and its status is never stored — it is derived from the result, the terminal, the
 * pending requests and the last hook event. Generic: it does not know what `/create` asks.
 */
export class GuidedService {
  private readonly now: () => Date;
  private readonly isAlive: (pid: number) => boolean;
  private readonly feedReader: TranscriptFeed;

  constructor(private readonly deps: GuidedServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.isAlive = deps.isAlive ?? processIsAlive;
    this.feedReader = deps.feed ?? new TranscriptFeed();
  }

  private get guidedDir(): string {
    return join(this.deps.dataDir, GUIDED_FILES.dir);
  }

  private dirOf(id: string): string {
    return join(this.guidedDir, id);
  }

  private indexOf(sessionId: string): string {
    return join(this.guidedDir, GUIDED_FILES.bySession, sessionId.toLowerCase());
  }

  /** Writes the input file and the hook's index, then starts the hidden terminal. Nothing half-made stays behind. */
  async start({ purpose, cwd, input }: StartGuided): Promise<GuidedView> {
    const id = randomUUID();
    const sessionId = randomUUID();
    const dir = this.dirOf(id);
    const inputPath = join(dir, GUIDED_COMMANDS[purpose].inputFile);
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(this.guidedDir, GUIDED_FILES.bySession), { recursive: true });
    try {
      writeFileSync(inputPath, input.endsWith('\n') ? input : `${input}\n`);
      // Before the process starts: the hook ignores a session it cannot find.
      writeFileSync(this.indexOf(sessionId), id);
      const terminal = await this.deps.terminals.createGuided({
        guidedId: id,
        sessionId,
        purpose,
        cwd,
        inputPath,
        addDirs: [dir],
        ...HIDDEN_SIZE,
      });
      const meta: GuidedMeta = { id, purpose, terminalId: terminal.id, claudeSessionId: sessionId, createdAt: this.now().toISOString() };
      writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      return this.view(meta);
    } catch (error) {
      rmSync(dir, { recursive: true, force: true });
      rmSync(this.indexOf(sessionId), { force: true });
      throw error;
    }
  }

  /** Open sessions of a purpose, oldest first. A folder without a valid meta.json (a start that died) is not one. */
  list(purpose: GuidedPurpose): GuidedView[] {
    if (!existsSync(this.guidedDir)) return [];
    return readdirSync(this.guidedDir)
      .filter(isUuid)
      .map((name) => readMeta(this.dirOf(name)))
      .filter((meta): meta is GuidedMeta => meta !== null && meta.purpose === purpose)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((meta) => this.view(meta));
  }

  get(id: string): GuidedView {
    return this.view(this.meta(id));
  }

  /**
   * The conversation so far, from the session's .jsonl, with the brief as its first entry (in place of the slash
   * command that carried it). `after` = how many entries the client has (feedPage).
   */
  async feed(id: string, after: number): Promise<{ entries: FeedEntry[]; cursor: string }> {
    const meta = this.meta(id);
    const brief: FeedEntry = { id: 'brief', type: 'user-text', text: this.readInput(meta), at: meta.createdAt };
    const cwd = this.deps.terminals.get(meta.terminalId)?.cwd;
    const transcript = cwd === undefined ? [] : await this.feedReader.read(this.deps.sessions.fileOf(cwd, meta.claudeSessionId));
    return feedPage([brief, ...transcript], after);
  }

  /** The owner's answer to an AskUserQuestion: one answer per question, keyed by the question's text. */
  async answer(id: string, { requestId, answers }: { requestId: string; answers: Record<string, string> }): Promise<void> {
    const meta = this.meta(id);
    const pending = this.livePending(meta);
    if (pending?.type !== 'question' || pending.requestId !== requestId) throw new AppError('GUIDED_002');
    const missing = pending.questions.filter((q) => !(q.question in answers)).map((q) => q.question);
    const unknown = Object.keys(answers).filter((key) => !pending.questions.some((q) => q.question === key));
    if (missing.length > 0 || unknown.length > 0) {
      throw new AppError('COMMON_001', undefined, [
        ...missing.map((q) => ({ field: 'answers', message: `falta a resposta a: ${q}` })),
        ...unknown.map((q) => ({ field: 'answers', message: `pergunta desconhecida: ${q}` })),
      ]);
    }
    await atomicWrite(join(this.dirOf(id), `answer-${requestId}.json`), JSON.stringify({ requestId, answers }));
  }

  async permission(id: string, { requestId, decision }: { requestId: string; decision: 'allow' | 'deny' }): Promise<void> {
    const meta = this.meta(id);
    const pending = this.livePending(meta);
    if (pending?.type !== 'permission' || pending.requestId !== requestId) throw new AppError('GUIDED_002');
    await atomicWrite(join(this.dirOf(id), `answer-${requestId}.json`), JSON.stringify({ requestId, decision }));
  }

  /**
   * Free text from the owner, typed into the PTY as a bracketed paste. Only while claude waits for it:
   * writing in the middle of a turn scrambles the TUI.
   */
  async message(id: string, text: string): Promise<void> {
    const meta = this.meta(id);
    const view = this.view(meta);
    if (view.status === 'stopped' || view.status === 'done' || view.status === 'failed') throw new AppError('GUIDED_003');
    if (view.status !== 'waiting-text' && view.status !== 'needs-you') throw new AppError('GUIDED_004');
    // The hook's UserPromptSubmit follows; recording it now stops a second message slipping in before it.
    this.writeEvent(meta.id, 'UserPromptSubmit');
    await this.deps.terminals.paste(meta.terminalId, text);
  }

  /**
   * Brings back a stopped session (`--resume`, through the terminal's reopen). A question or permission that was
   * waiting died with its hook; the resumed conversation sits at the prompt, so it shows as waiting for text.
   */
  async resume(id: string, size: { cols: number; rows: number }): Promise<GuidedView> {
    const meta = this.meta(id);
    for (const file of this.pendingFiles(meta.id)) rmSync(join(this.dirOf(meta.id), file), { force: true });
    await this.deps.terminals.reopen(meta.terminalId, size);
    this.writeEvent(meta.id, 'Stop');
    return this.view(meta);
  }

  /** "Ver terminal": the hidden terminal joins the grid. */
  reveal(id: string) {
    return this.deps.terminals.reveal(this.meta(id).terminalId);
  }

  /** Cancel (running) or close (finished): the terminal goes to the history, the folder and its index are deleted. */
  async remove(id: string): Promise<void> {
    const meta = this.meta(id);
    try {
      await this.deps.terminals.close(meta.terminalId);
    } catch (error) {
      // Closed already (by hand, once revealed): the session still has to go.
      if (!(error instanceof AppError && error.code === 'TERMINAL_001')) throw error;
    }
    // Deleting the folder also ends any hook still waiting in it.
    rmSync(this.dirOf(meta.id), { recursive: true, force: true });
    rmSync(this.indexOf(meta.claudeSessionId), { force: true });
  }

  private meta(id: string): GuidedMeta {
    const meta = isUuid(id) ? readMeta(this.dirOf(id)) : null;
    if (!meta || meta.id !== id) throw new AppError('GUIDED_001');
    return meta;
  }

  private readInput(meta: GuidedMeta): string {
    try {
      return readFileSync(join(this.dirOf(meta.id), GUIDED_COMMANDS[meta.purpose].inputFile), 'utf8').trim();
    } catch {
      return '';
    }
  }

  private writeEvent(id: string, event: GuidedEvent): void {
    writeFileSync(join(this.dirOf(id), 'event.json'), JSON.stringify({ event, at: this.now().toISOString() }));
  }

  private lastEvent(id: string): GuidedEvent | null {
    try {
      const { event } = JSON.parse(readFileSync(join(this.dirOf(id), 'event.json'), 'utf8')) as { event?: unknown };
      return GUIDED_EVENTS.includes(event as GuidedEvent) ? (event as GuidedEvent) : null;
    } catch {
      return null;
    }
  }

  private pendingFiles(id: string): string[] {
    try {
      return readdirSync(this.dirOf(id)).filter((name) => PENDING_FILE.test(name));
    } catch {
      return [];
    }
  }

  /** Every readable pending request, oldest first, and whether its hook is still waiting. */
  private pendings(meta: GuidedMeta): { pending: PendingFile; alive: boolean }[] {
    return this.pendingFiles(meta.id)
      .map((name) => readPending(join(this.dirOf(meta.id), name), PENDING_FILE.exec(name)![1]!))
      .filter((pending): pending is PendingFile => pending !== null)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((pending) => ({ pending, alive: this.isAlive(pending.pid) }));
  }

  private livePending(meta: GuidedMeta): PendingFile | undefined {
    return this.pendings(meta).find((p) => p.alive)?.pending;
  }

  /** The status, in this order (spec §4.1): a result; a terminal that is not running; a pending request; the last event. */
  private view(meta: GuidedMeta): GuidedView {
    const base = { id: meta.id, purpose: meta.purpose, terminalId: meta.terminalId, createdAt: meta.createdAt };
    const result = readResult(join(this.dirOf(meta.id), 'result.json'));
    if (result !== undefined) {
      if ('invalid' in result) return { ...base, status: 'failed', pending: null, result: null, error: `result.json inválido: ${result.invalid}` };
      return { ...base, status: result.status, pending: null, result, error: result.status === 'failed' ? (result.error ?? null) : null };
    }
    if (this.deps.terminals.get(meta.terminalId)?.status !== 'running') {
      return { ...base, status: 'stopped', pending: null, result: null, error: null };
    }
    const pendings = this.pendings(meta);
    const live = pendings.find((p) => p.alive)?.pending;
    if (live?.type === 'question') {
      return { ...base, status: 'question', pending: { requestId: live.requestId, type: 'question', questions: live.questions }, result: null, error: null };
    }
    if (live?.type === 'permission') {
      return {
        ...base,
        status: 'permission',
        pending: { requestId: live.requestId, type: 'permission', tool: live.tool, summary: live.summary },
        result: null,
        error: null,
      };
    }
    // A request whose hook is gone (timed out, or killed): the TUI asks it now — only the terminal shows it.
    const event = this.lastEvent(meta.id);
    const status = pendings.length > 0 || event === 'Notification' ? 'needs-you' : event === 'Stop' ? 'waiting-text' : 'working';
    return { ...base, status, pending: null, result: null, error: null };
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it exists, it is just not ours to signal.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readMeta(dir: string): GuidedMeta | null {
  try {
    const parsed = guidedMetaSchema.safeParse(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A pending file that does not parse, or whose requestId is not the one in its name, is ignored. */
function readPending(file: string, requestId: string): PendingFile | null {
  try {
    const parsed = pendingFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success && parsed.data.requestId.toLowerCase() === requestId.toLowerCase() ? parsed.data : null;
  } catch {
    return null;
  }
}

/** undefined = no result yet; `{ invalid }` = there is one, but it breaks the contract (field and reason). */
function readResult(file: string): CreateResult | { invalid: string } | undefined {
  if (!existsSync(file)) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // The skill may still be writing it: the next poll reads it whole (the Write tool replaces the file at once).
    return { invalid: 'não é JSON' };
  }
  const parsed = createResultSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { invalid: `${issue.path.join('.') || '(raiz)'} — ${issue.message}` };
  }
  return parsed.data;
}
