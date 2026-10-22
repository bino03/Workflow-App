import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { ClaudeSessions } from '../sessions/claudeSessions.js';
import type { AppState, SavedTerminal } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import { type ClaudeLaunch, claudeArgs } from './claudeArgs.js';
import { remoteControlName } from './remoteName.js';
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
  /** Launched with --remote-control: also reachable from the Claude app (ADR 0017). */
  remoteControl: boolean;
};

export type CreateTerminal = {
  cwd: string;
  mode: 'new' | 'resume' | 'continue';
  sessionId?: string;
  label?: string | null;
  cols: number;
  rows: number;
  /** Only the Telegram bot sets it (ADR 0017); the REST body has no such field. */
  remoteControl?: boolean;
};

export type TerminalsServiceDeps = {
  stateStore: StateStore;
  terminalManager: TerminalManager;
  sessions: ClaudeSessions;
  allowedRoots: readonly string[];
  /** DATA_DIR/claude-settings.json when the quota status line is on (step 8). */
  settingsPath?: string;
  /**
   * Whether Claude Code already trusts a folder (`isTrustedFolder`, sessions/claudeTrust.ts). Only Remote
   * Control launches ask: nobody is at the PTY to answer the trust dialog. Omitted → never trusted.
   */
  isTrustedFolder?: (cwd: string) => Promise<boolean>;
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
    const remoteControl = request.remoteControl === true;
    if (remoteControl) await this.assertTrusted(cwd);
    const launch = await this.launchFor(cwd, request);
    const id = randomUUID();
    this.spawn(id, cwd, launch, request, remoteControl ? await this.remoteControlFor(cwd, launch) : undefined);

    const at = this.now().toISOString();
    const saved: SavedTerminal = {
      id,
      label: normalizeLabel(request.label),
      cwd,
      claudeSessionId: launch.sessionId,
      createdAt: at,
      updatedAt: at,
      lastOpenedAt: at,
      remoteControl,
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

  /**
   * Brings back an exited or stopped terminal, keeping its id, label and position: `--resume` when the
   * conversation is saved. Claude Code does not save a session that never had a message, so without a
   * .jsonl there is nothing to resume — the same terminal starts a new conversation with the same UUID
   * (`freshSession: true`, the UI says so).
   *
   * A terminal saved with Remote Control comes back with it; `remoteControl: true` turns it on (the bot).
   */
  async reopen(
    id: string,
    size: { cols: number; rows: number },
    options: { remoteControl?: boolean } = {},
  ): Promise<TerminalView & { freshSession: boolean }> {
    const saved = this.saved(id);
    if (!saved) throw new AppError('TERMINAL_001');
    const inMemory = this.deps.terminalManager.get(id);
    if (inMemory?.status === 'running') throw new AppError('TERMINAL_006');
    // ALLOWED_ROOTS may have changed since the terminal was opened.
    const cwd = resolveAllowedPath(saved.cwd, this.deps.allowedRoots);
    const remoteControl = options.remoteControl ?? saved.remoteControl;
    if (remoteControl) await this.assertTrusted(cwd);
    const freshSession = !this.deps.sessions.hasSession(cwd, saved.claudeSessionId);
    const launch: ClaudeLaunch = { kind: freshSession ? 'new' : 'resume', sessionId: saved.claudeSessionId };
    const remote = remoteControl ? await this.remoteControlFor(cwd, launch) : undefined;

    if (inMemory) await this.deps.terminalManager.kill(id); // exited: forget it so the id can be reused
    this.spawn(id, cwd, launch, size, remote);

    const at = this.now().toISOString();
    this.deps.stateStore.update((draft) => {
      const terminal = draft.terminals.find((t) => t.id === id);
      if (terminal) Object.assign(terminal, { cwd, remoteControl, lastOpenedAt: at, updatedAt: at });
      touchFolder(draft, cwd, at);
    });
    return { ...this.view(this.saved(id)!), freshSession };
  }

  /**
   * Ends the process but keeps the terminal, which shows as stopped with Reopen — what the bot's /parar does
   * (unlike close, it does not move to the history).
   */
  async stop(id: string): Promise<TerminalView> {
    const saved = this.saved(id);
    if (!saved) throw new AppError('TERMINAL_001');
    await this.deps.terminalManager.kill(id);
    return this.view(saved);
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

  private async assertTrusted(cwd: string): Promise<void> {
    const trusted = (await this.deps.isTrustedFolder?.(cwd)) ?? false;
    if (!trusted) throw new AppError('TERMINAL_007');
  }

  /** A new conversation gets Claude Code's automatic name (it follows the first prompt); a resumed one, "project · title". */
  private async remoteControlFor(cwd: string, launch: ClaudeLaunch): Promise<{ name?: string }> {
    if (launch.kind === 'new') return {};
    const info = await this.deps.sessions.sessionInfo(cwd, launch.sessionId);
    const name = remoteControlName(cwd, info?.preview ?? null);
    return name === undefined ? {} : { name };
  }

  private spawn(
    id: string,
    cwd: string,
    launch: ClaudeLaunch,
    size: { cols: number; rows: number },
    remoteControl?: { name?: string },
  ): void {
    const args = claudeArgs(launch, { settingsPath: this.deps.settingsPath, remoteControl });
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
      remoteControl: saved.remoteControl,
    };
  }
}

/** Opening a terminal in a folder makes it a recent one (or refreshes it). */
function touchFolder(draft: AppState, path: string, at: string): void {
  const folder = draft.folders.find((f) => f.path === path);
  if (folder) folder.lastUsedAt = at;
  else draft.folders.push({ path, favorite: false, lastUsedAt: at });
}
