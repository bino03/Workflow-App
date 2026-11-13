import { existsSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { AppError } from '../common/errors.js';
import { isInsideRoot, resolveAllowedPath } from '../folders/cwdPolicy.js';
import type { DevPort } from '../preview/listeningPorts.js';
import type { CreateAppRunTerminal, TerminalView } from '../terminals/terminalsService.js';
import type { AppRunError, AppRunUnavailableReason, AppRunView } from './appRun.schemas.js';

/** What an app run needs from the terminals (terminals/terminalsService.ts). */
export type AppRunTerminals = {
  createAppRun(request: CreateAppRunTerminal): Promise<TerminalView>;
  get(id: string): TerminalView | undefined;
  paste(id: string, text: string): Promise<void>;
  waitForQuiet(id: string, options: { quietMs: number; timeoutMs: number }): Promise<boolean>;
  reveal(id: string): TerminalView;
  close(id: string): Promise<void>;
};

export type AppRunServiceDeps = {
  terminals: AppRunTerminals;
  /** The terminal's last real pid (TerminalManager), or undefined — 0 means "not up yet" (ADR 0029). */
  pidOf: (terminalId: string) => number | undefined;
  /** devPortsOf, already excluding the backend's own PORT. */
  devPorts: (rootPid: number) => Promise<DevPort[]>;
  allowedRoots: readonly string[];
  /** The Workflow App's own folder: never run from itself (CLAUDE.md rule 8). */
  selfPath: string;
  /** Both skills on disk — `.claude/skills/{run,stop}/SKILL.md`. Default: the file system. */
  hasRunAndStop?: (projectPath: string) => boolean;
  log?: { info(obj: object, msg: string): void; warn(obj: object, msg: string): void };
  /** No port for this long after Correr → "Não arrancou". Default 3 min. */
  startTimeoutMs?: number;
  /** After `/stop`, how long the ports get to close before the terminal is closed anyway. Default 20 s. */
  stopGraceMs?: number;
  /** How often a stop checks the ports. Default 1 s. */
  stopPollMs?: number;
  now?: () => Date;
};

type Entry = {
  path: string;
  terminalId: string;
  phase: 'starting' | 'running' | 'stopping' | 'failed';
  startedAt: Date;
  runningSince: Date | null;
  ports: number[];
  error: AppRunError | null;
};

/** The size of the hidden terminal; "Ver terminal" resizes it to the grid's when it is shown. */
const HIDDEN_SIZE = { cols: 120, rows: 32 };

// Windows paths are case-insensitive: C:\Dev and c:\dev are the same project.
const keyOf = (path: string) => (process.platform === 'win32' ? path.toLowerCase() : path);

const defaultHasRunAndStop = (path: string) =>
  existsSync(join(path, '.claude', 'skills', 'run', 'SKILL.md')) && existsSync(join(path, '.claude', 'skills', 'stop', 'SKILL.md'));

function realOrSelf(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

/**
 * Runs and stops a project's app (ADR 0030): a hidden terminal whose first message is `/run`; "running" means ports
 * listening below it. State lives in memory — it dies with the PTYs on a backend restart. The GET brings it up to
 * date on demand; the only timer is a stop's 20 s safety net.
 */
export class AppRunService {
  private readonly runs = new Map<string, Entry>();
  /** A start in flight per project: a second click is a 409, not a second terminal. */
  private readonly starting = new Set<string>();
  private readonly selfPath: string;
  private readonly hasRunAndStop: (path: string) => boolean;
  private readonly now: () => Date;

  constructor(private readonly deps: AppRunServiceDeps) {
    this.selfPath = realOrSelf(deps.selfPath);
    this.hasRunAndStop = deps.hasRunAndStop ?? defaultHasRunAndStop;
    this.now = deps.now ?? (() => new Date());
  }

  async get(input: string): Promise<AppRunView> {
    const path = this.resolve(input);
    const unavailable = this.unavailable(path);
    if (unavailable === 'self') return idleView(path, 'self');
    const entry = this.runs.get(keyOf(path));
    if (entry) {
      await this.refresh(entry);
      if (this.runs.get(keyOf(path)) === entry) return view(entry);
    }
    return idleView(path, unavailable);
  }

  async start(input: string): Promise<AppRunView> {
    const path = this.resolve(input);
    const unavailable = this.unavailable(path);
    if (unavailable === 'self') throw new AppError('APPRUN_004');
    if (unavailable === 'missing-skills') throw new AppError('APPRUN_002');
    const key = keyOf(path);
    if (this.starting.has(key)) throw new AppError('APPRUN_001');
    const existing = this.runs.get(key);
    if (existing && existing.phase !== 'failed') throw new AppError('APPRUN_001');

    this.starting.add(key);
    try {
      // Correr after a failure starts over: the old terminal (maybe revealed) goes first.
      if (existing) await this.discard(existing);
      const terminal = await this.deps.terminals.createAppRun({ cwd: path, label: `${basename(path)} · run`, ...HIDDEN_SIZE });
      const entry: Entry = {
        path,
        terminalId: terminal.id,
        phase: 'starting',
        startedAt: this.now(),
        runningSince: null,
        ports: [],
        error: null,
      };
      this.runs.set(key, entry);
      this.deps.log?.info({ path, terminalId: terminal.id }, 'app run started');
      return view(entry);
    } finally {
      this.starting.delete(key);
    }
  }

  /**
   * Types `/stop` into the run's own conversation (it knows the background tasks' ids); the terminal is closed once
   * the ports are gone and the turn is over, or after the grace period whatever happens. A failed run just goes.
   */
  async stop(input: string): Promise<AppRunView> {
    const path = this.resolve(input);
    const entry = this.runs.get(keyOf(path));
    if (!entry) throw new AppError('APPRUN_003');
    if (entry.phase === 'stopping') return view(entry);
    if (entry.phase === 'failed') {
      await this.discard(entry);
      return idleView(path, this.unavailable(path));
    }

    entry.phase = 'stopping';
    let typed = true;
    try {
      await this.deps.terminals.paste(entry.terminalId, '/stop');
    } catch (error) {
      // Not running any more (or gone): nothing to type into — straight to closing.
      typed = false;
      this.deps.log?.warn({ path, err: String(error) }, 'app run: /stop could not be typed');
    }
    void this.finishStop(entry, typed).catch((error: unknown) => this.deps.log?.warn({ path, err: String(error) }, 'app run: stop failed'));
    return view(entry);
  }

  /** "Ver terminal": the hidden terminal becomes a normal one in the grid; the run itself carries on. */
  async reveal(input: string): Promise<{ terminalId: string }> {
    const path = this.resolve(input);
    const entry = this.runs.get(keyOf(path));
    if (!entry || !this.deps.terminals.get(entry.terminalId)) throw new AppError('APPRUN_003');
    this.deps.terminals.reveal(entry.terminalId);
    return { terminalId: entry.terminalId };
  }

  private async finishStop(entry: Entry, typed: boolean): Promise<void> {
    const graceMs = this.deps.stopGraceMs ?? 20_000;
    const pollMs = this.deps.stopPollMs ?? 1_000;
    const deadline = Date.now() + graceMs;
    if (typed) {
      while (Date.now() < deadline && (await this.currentPorts(entry)).length > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
      // Ports gone: let the turn finish (a `docker compose down` may still be running) before the terminal goes.
      const left = deadline - Date.now();
      if (left > 0) await this.deps.terminals.waitForQuiet(entry.terminalId, { quietMs: 2_000, timeoutMs: left });
    }
    const portsLeft = (await this.currentPorts(entry)).length;
    await this.discard(entry);
    this.deps.log?.info({ path: entry.path, portsLeft }, 'app run stopped');
  }

  /** Brings an entry up to date from the terminal and the OS. Only the GET calls it. */
  private async refresh(entry: Entry): Promise<void> {
    if (entry.phase === 'stopping' || entry.phase === 'failed') return;
    const terminal = this.deps.terminals.get(entry.terminalId);
    if (!terminal) {
      // Closed from elsewhere (the revealed terminal's ✕): nothing is running any more.
      this.runs.delete(keyOf(entry.path));
      return;
    }
    if (terminal.status !== 'running') {
      this.fail(entry, entry.phase === 'running' ? 'ports-gone' : 'exited');
      return;
    }
    const ports = await this.currentPorts(entry);
    if (entry.phase === 'starting') {
      if (ports.length > 0) {
        Object.assign(entry, { phase: 'running', runningSince: this.now(), ports });
      } else if (this.now().getTime() - entry.startedAt.getTime() >= (this.deps.startTimeoutMs ?? 180_000)) {
        this.fail(entry, 'no-port');
      }
      return;
    }
    if (ports.length > 0) entry.ports = ports;
    else this.fail(entry, 'ports-gone');
  }

  private async currentPorts(entry: Entry): Promise<number[]> {
    const pid = this.deps.pidOf(entry.terminalId);
    if (pid === undefined || pid <= 0) return [];
    return (await this.deps.devPorts(pid)).map((p) => p.port);
  }

  private fail(entry: Entry, error: AppRunError): void {
    Object.assign(entry, { phase: 'failed', error, ports: [] });
    this.deps.log?.warn({ path: entry.path, error }, 'app run failed');
  }

  /**
   * Closes the run's terminal (which kills its process tree, ~1.6 s) and only then forgets the run: until then the
   * GET still shows it, so a Correr in between is a 409 instead of a second terminal next to a dying one.
   */
  private async discard(entry: Entry): Promise<void> {
    if (this.deps.terminals.get(entry.terminalId)) {
      await this.deps.terminals.close(entry.terminalId).catch((error: unknown) => {
        this.deps.log?.warn({ path: entry.path, err: String(error) }, 'app run: closing the terminal failed');
      });
    }
    if (this.runs.get(keyOf(entry.path)) === entry) this.runs.delete(keyOf(entry.path));
  }

  private resolve(input: string): string {
    return resolveAllowedPath(input, this.deps.allowedRoots);
  }

  private unavailable(path: string): AppRunUnavailableReason | null {
    if (isInsideRoot(path, this.selfPath)) return 'self';
    return this.hasRunAndStop(path) ? null : 'missing-skills';
  }
}

function view(entry: Entry): AppRunView {
  return {
    path: entry.path,
    phase: entry.phase,
    unavailableReason: null,
    terminalId: entry.terminalId,
    startedAt: entry.startedAt.toISOString(),
    runningSince: entry.runningSince?.toISOString() ?? null,
    ports: entry.ports,
    error: entry.error,
  };
}

function idleView(path: string, unavailableReason: AppRunUnavailableReason | null): AppRunView {
  return {
    path,
    phase: unavailableReason ? 'unavailable' : 'idle',
    unavailableReason,
    terminalId: null,
    startedAt: null,
    runningSince: null,
    ports: [],
    error: null,
  };
}
