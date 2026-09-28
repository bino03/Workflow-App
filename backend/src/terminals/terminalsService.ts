import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { ClaudeSessions } from '../sessions/claudeSessions.js';
import type { AppState, SavedTerminal } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import { type ClaudeLaunch, claudeArgs } from './claudeArgs.js';
import { ClaudeBinError } from './spawnClaude.js';
import { TerminalLimitError, type TerminalManager } from './terminalManager.js';

/** running/exited come from memory; stopped = saved in state.json but not in memory (the backend restarted). */
export type TerminalStatus = 'running' | 'exited' | 'stopped';

export type TerminalView = {
  id: string;
  label: string | null;
  cwd: string;
  claudeSessionId: string;
  status: TerminalStatus;
  exitCode: number | null;
  createdAt: string;
  lastOpenedAt: string;
};

export type CreateTerminal = {
  cwd: string;
  mode: 'new' | 'resume' | 'continue';
  sessionId?: string;
  label?: string | null;
  cols: number;
  rows: number;
};

export type TerminalsServiceDeps = {
  stateStore: StateStore;
  terminalManager: TerminalManager;
  sessions: ClaudeSessions;
  allowedRoots: readonly string[];
  /** DATA_DIR/claude-settings.json when the quota status line is on (step 8). */
  settingsPath?: string;
  now?: () => Date;
};

const normalizeLabel = (label: string | null | undefined) => (label?.trim() ? label.trim() : null);

/**
 * The terminals' life cycle: joins what survives a restart (state.json) with what does not (the PTYs in
 * TerminalManager). The only place that decides which `claude` to launch, and where.
 */
export class TerminalsService {
  private readonly now: () => Date;

  constructor(private readonly deps: TerminalsServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  list(): TerminalView[] {
    return [...this.deps.stateStore.read().terminals]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((saved) => this.view(saved));
  }

  get(id: string): TerminalView | undefined {
    const saved = this.saved(id);
    return saved && this.view(saved);
  }

  /** Terminal id by claudeSessionId, for every saved terminal (running, exited or stopped). */
  sessionsInUse(): Map<string, string> {
    return new Map(this.deps.stateStore.read().terminals.map((terminal) => [terminal.claudeSessionId, terminal.id]));
  }

  async create(request: CreateTerminal): Promise<TerminalView> {
    const cwd = resolveAllowedPath(request.cwd, this.deps.allowedRoots);
    const launch = await this.launchFor(cwd, request);
    const id = randomUUID();
    this.spawn(id, cwd, launch, request);

    const at = this.now().toISOString();
    const saved: SavedTerminal = {
      id,
      label: normalizeLabel(request.label),
      cwd,
      claudeSessionId: launch.sessionId,
      createdAt: at,
      updatedAt: at,
      lastOpenedAt: at,
    };
    try {
      this.deps.stateStore.update((draft) => {
        draft.terminals.push(saved);
        touchFolder(draft, cwd, at);
      });
    } catch (error) {
      // A terminal that is not saved could never be listed or closed: do not leave its process behind.
      await this.deps.terminalManager.kill(id);
      throw error;
    }
    return this.view(saved);
  }

  /** Brings back an exited or stopped terminal with `--resume`, keeping its id, label and position. */
  async reopen(id: string, size: { cols: number; rows: number }): Promise<TerminalView> {
    const saved = this.saved(id);
    if (!saved) throw new AppError('TERMINAL_001');
    const inMemory = this.deps.terminalManager.get(id);
    if (inMemory?.status === 'running') throw new AppError('TERMINAL_006');
    // ALLOWED_ROOTS may have changed since the terminal was opened.
    const cwd = resolveAllowedPath(saved.cwd, this.deps.allowedRoots);
    if (!this.deps.sessions.hasSession(cwd, saved.claudeSessionId)) throw new AppError('TERMINAL_004');

    if (inMemory) await this.deps.terminalManager.kill(id); // exited: forget it so the id can be reused
    this.spawn(id, cwd, { kind: 'resume', sessionId: saved.claudeSessionId }, size);

    const at = this.now().toISOString();
    this.deps.stateStore.update((draft) => {
      const terminal = draft.terminals.find((t) => t.id === id);
      if (terminal) Object.assign(terminal, { cwd, lastOpenedAt: at, updatedAt: at });
      touchFolder(draft, cwd, at);
    });
    return this.view(this.saved(id)!);
  }

  rename(id: string, label: string | null): TerminalView {
    if (!this.saved(id)) throw new AppError('TERMINAL_001');
    const at = this.now().toISOString();
    this.deps.stateStore.update((draft) => {
      const terminal = draft.terminals.find((t) => t.id === id);
      if (terminal) Object.assign(terminal, { label: normalizeLabel(label), updatedAt: at });
    });
    return this.view(this.saved(id)!);
  }

  /** Kills the process tree and moves the terminal to the history, with a summary from its .jsonl. */
  async close(id: string): Promise<void> {
    const saved = this.saved(id);
    if (!saved) throw new AppError('TERMINAL_001');
    await this.deps.terminalManager.kill(id);
    // readSummary never throws: a missing or odd .jsonl leaves the history entry without a summary.
    const { summary, summarySource } = await this.deps.sessions.readSummary(saved.cwd, saved.claudeSessionId);
    const closedAt = this.now().toISOString();
    this.deps.stateStore.update((draft) => {
      draft.terminals = draft.terminals.filter((t) => t.id !== id);
      draft.closedTerminals.push({
        id: saved.id,
        label: saved.label,
        cwd: saved.cwd,
        claudeSessionId: saved.claudeSessionId,
        openedAt: saved.createdAt,
        closedAt,
        summary,
        summarySource,
      });
    });
  }

  private async launchFor(cwd: string, request: CreateTerminal): Promise<ClaudeLaunch> {
    if (request.mode === 'new') return { kind: 'new', sessionId: randomUUID() };
    const sessionId = request.mode === 'continue' ? await this.deps.sessions.latestSessionId(cwd) : request.sessionId;
    if (!sessionId) throw new AppError(request.mode === 'continue' ? 'SESSION_001' : 'COMMON_001');
    // Two processes writing the same .jsonl would corrupt the conversation.
    if (this.sessionsInUse().has(sessionId)) throw new AppError('TERMINAL_003');
    if (!this.deps.sessions.hasSession(cwd, sessionId)) throw new AppError('TERMINAL_004');
    return { kind: 'resume', sessionId };
  }

  private spawn(id: string, cwd: string, launch: ClaudeLaunch, size: { cols: number; rows: number }): void {
    const args = claudeArgs(launch, { settingsPath: this.deps.settingsPath });
    try {
      this.deps.terminalManager.create({ id, cwd, cols: size.cols, rows: size.rows, args });
    } catch (error) {
      if (error instanceof TerminalLimitError) throw new AppError('TERMINAL_002');
      if (error instanceof ClaudeBinError) throw new AppError('TERMINAL_005');
      throw error;
    }
  }

  private saved(id: string): SavedTerminal | undefined {
    return this.deps.stateStore.read().terminals.find((terminal) => terminal.id === id);
  }

  private view(saved: SavedTerminal): TerminalView {
    const inMemory = this.deps.terminalManager.get(saved.id);
    return {
      id: saved.id,
      label: saved.label,
      cwd: saved.cwd,
      claudeSessionId: saved.claudeSessionId,
      status: inMemory?.status ?? 'stopped',
      exitCode: inMemory?.exitCode ?? null,
      createdAt: saved.createdAt,
      lastOpenedAt: saved.lastOpenedAt,
    };
  }
}

/** Opening a terminal in a folder makes it a recent one (or refreshes it). */
function touchFolder(draft: AppState, path: string, at: string): void {
  const folder = draft.folders.find((f) => f.path === path);
  if (folder) folder.lastUsedAt = at;
  else draft.folders.push({ path, favorite: false, lastUsedAt: at });
}
