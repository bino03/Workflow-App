import { basename } from 'node:path';
import { AppError } from '../common/errors.js';
import type { ProjectEntry } from '../projects/project.schemas.js';
import type { SessionInfo } from '../sessions/claudeSessions.js';
import type { TerminalView } from '../terminals/terminalsService.js';
import type { UsageView } from '../usage/usageFiles.js';
import * as text from './botMessages.js';
import type { MenuStore } from './menuStore.js';
import type { InlineKeyboard } from './telegramApi.js';

/** What a button was offered for. Checked again when it runs: the project, the session and the terminal state. */
export type BotAction =
  | { kind: 'projects' }
  | { kind: 'project'; path: string }
  | { kind: 'open'; path: string; target: 'new' | 'continue' | { sessionId: string } }
  | { kind: 'restart'; terminalId: string }
  | { kind: 'stop-ask'; terminalId: string }
  | { kind: 'stop'; terminalId: string }
  | { kind: 'cancel' };

export type BotReply = { text: string; keyboard?: InlineKeyboard };

/** The slices of the app's services the bot uses — the same instances the REST routes use. */
export type BotActionsDeps = {
  projects: { list(): Promise<ProjectEntry[]> };
  sessions: { listSessions(cwd: string): Promise<SessionInfo[]>; latestSessionId(cwd: string): Promise<string | null> };
  terminals: {
    list(): TerminalView[];
    get(id: string): TerminalView | undefined;
    sessionsInUse(): Map<string, string>;
    create(request: {
      cwd: string;
      mode: 'new' | 'resume';
      sessionId?: string;
      cols: number;
      rows: number;
      remoteControl: true;
    }): Promise<TerminalView>;
    reopen(id: string, size: { cols: number; rows: number }, options: { remoteControl: true }): Promise<TerminalView>;
    stop(id: string): Promise<TerminalView>;
  };
  readUsage: () => UsageView;
  menus: MenuStore<BotAction>;
  timeZone?: string;
};

/** No browser says how big the terminal is; the first browser that attaches resizes it. */
export const BOT_PTY_SIZE = { cols: 120, rows: 32 };
const SESSIONS_SHOWN = 5;
const BUTTON_TITLE_MAX = 40;

const cut = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

/**
 * The bot's actions, one reply each. Errors from the services become a sentence (botMessages.errorText);
 * nothing here reads or sends what a terminal shows.
 */
export class BotActions {
  constructor(private readonly deps: BotActionsDeps) {}

  async run(action: BotAction): Promise<BotReply> {
    try {
      switch (action.kind) {
        case 'projects':
          return await this.projects();
        case 'project':
          return await this.project(action.path);
        case 'open':
          return await this.open(action.path, action.target);
        case 'restart':
          return await this.restart(action.terminalId);
        case 'stop-ask':
          return this.askStop(action.terminalId);
        case 'stop':
          return await this.stop(action.terminalId);
        case 'cancel':
          return { text: text.CANCELLED };
      }
    } catch (error) {
      if (error instanceof AppError) return { text: text.errorText(error.code) };
      throw error;
    }
  }

  status(): BotReply {
    const running = this.deps.terminals.list().filter((terminal) => terminal.status === 'running');
    const rows = running.map((terminal) => ({ name: this.nameOf(terminal), remoteControl: terminal.remoteControl }));
    return { text: text.statusText(rows, this.deps.readUsage(), this.deps.timeZone) };
  }

  stopMenu(): BotReply {
    const running = this.deps.terminals.list().filter((terminal) => terminal.status === 'running');
    if (running.length === 0) return { text: text.NOTHING_RUNNING };
    return {
      text: text.CHOOSE_TO_STOP,
      keyboard: running.map((terminal) => [this.button(cut(this.nameOf(terminal), 60), { kind: 'stop-ask', terminalId: terminal.id })]),
    };
  }

  async projects(): Promise<BotReply> {
    const projects = await this.deps.projects.list();
    if (projects.length === 0) return { text: text.NO_PROJECTS };
    return {
      text: text.CHOOSE_PROJECT,
      keyboard: projects.map((project) => [this.button(cut(project.name, 60), { kind: 'project', path: project.path })]),
    };
  }

  private async project(path: string): Promise<BotReply> {
    const project = await this.findProject(path);
    if (!project) return { text: text.PROJECT_GONE };
    const sessions = (await this.deps.sessions.listSessions(project.path)).slice(0, SESSIONS_SHOWN);
    const inUse = this.deps.terminals.sessionsInUse();
    const keyboard: InlineKeyboard = [];
    if (sessions.length > 0) keyboard.push([this.button(text.BUTTON.continueLast, { kind: 'open', path: project.path, target: 'continue' })]);
    for (const session of sessions) {
      const title = cut(session.preview ?? 'sem título', BUTTON_TITLE_MAX);
      const mark = inUse.has(session.id) ? '● ' : '';
      keyboard.push([
        this.button(`${mark}${title} · ${text.formatWhen(session.updatedAt, this.deps.timeZone)}`, {
          kind: 'open',
          path: project.path,
          target: { sessionId: session.id },
        }),
      ]);
    }
    keyboard.push([this.button(text.BUTTON.newConversation, { kind: 'open', path: project.path, target: 'new' })]);
    keyboard.push([this.button(text.BUTTON.back, { kind: 'projects' })]);
    return { text: text.projectMenu(project.name, sessions.length), keyboard };
  }

  private async open(path: string, target: 'new' | 'continue' | { sessionId: string }): Promise<BotReply> {
    const project = await this.findProject(path);
    if (!project) return { text: text.PROJECT_GONE };
    const { terminals } = this.deps;

    if (target === 'new') {
      await terminals.create({ cwd: project.path, mode: 'new', remoteControl: true, ...BOT_PTY_SIZE });
      return { text: text.openedNew(project.name) };
    }

    const sessionId = target === 'continue' ? await this.deps.sessions.latestSessionId(project.path) : target.sessionId;
    if (!sessionId) throw new AppError('SESSION_001');
    const title = await this.titleOf(project.path, sessionId);

    const terminalId = terminals.sessionsInUse().get(sessionId);
    const terminal = terminalId === undefined ? undefined : terminals.get(terminalId);
    if (!terminal) {
      await terminals.create({ cwd: project.path, mode: 'resume', sessionId, remoteControl: true, ...BOT_PTY_SIZE });
      return { text: text.opened(project.name, title) };
    }
    if (terminal.status === 'running' && terminal.remoteControl) return { text: text.alreadyRemote(this.nameOf(terminal)) };
    if (terminal.status === 'running') {
      return {
        text: text.askRestart(this.nameOf(terminal)),
        keyboard: [
          [this.button(text.BUTTON.restart, { kind: 'restart', terminalId: terminal.id })],
          [this.button(text.BUTTON.cancel, { kind: 'cancel' })],
        ],
      };
    }
    // Saved but not running (exited, or stopped by a restart or /parar): bring the same terminal back with RC.
    await terminals.reopen(terminal.id, BOT_PTY_SIZE, { remoteControl: true });
    return { text: text.opened(project.name, title) };
  }

  /** The confirmed "restart with Remote Control": stop the running terminal and reopen the same one with RC. */
  private async restart(terminalId: string): Promise<BotReply> {
    const terminal = this.deps.terminals.get(terminalId);
    if (!terminal) throw new AppError('TERMINAL_001');
    if (terminal.status === 'running' && terminal.remoteControl) return { text: text.alreadyRemote(this.nameOf(terminal)) };
    if (terminal.status === 'running') await this.deps.terminals.stop(terminalId);
    await this.deps.terminals.reopen(terminalId, BOT_PTY_SIZE, { remoteControl: true });
    return { text: text.opened(this.nameOf(terminal), await this.titleOf(terminal.cwd, terminal.claudeSessionId)) };
  }

  private askStop(terminalId: string): BotReply {
    const terminal = this.deps.terminals.get(terminalId);
    if (!terminal) throw new AppError('TERMINAL_001');
    if (terminal.status !== 'running') return { text: text.NOTHING_RUNNING };
    return {
      text: text.askStop(this.nameOf(terminal)),
      keyboard: [[this.button(text.BUTTON.stopYes, { kind: 'stop', terminalId })], [this.button(text.BUTTON.cancel, { kind: 'cancel' })]],
    };
  }

  private async stop(terminalId: string): Promise<BotReply> {
    const terminal = await this.deps.terminals.stop(terminalId);
    return { text: text.stopped(this.nameOf(terminal)) };
  }

  /** Only paths that are still in the registry (and so inside ALLOWED_ROOTS) — a button can be old. */
  private async findProject(path: string): Promise<ProjectEntry | undefined> {
    return (await this.deps.projects.list()).find((project) => project.path === path);
  }

  private async titleOf(cwd: string, sessionId: string): Promise<string | null> {
    const sessions = await this.deps.sessions.listSessions(cwd);
    const preview = sessions.find((session) => session.id === sessionId)?.preview ?? null;
    return preview && cut(preview, 80);
  }

  private nameOf(terminal: TerminalView): string {
    return terminal.label ?? basename(terminal.cwd);
  }

  private button(label: string, action: BotAction) {
    return { text: label, callback_data: this.deps.menus.put(action) };
  }
}
