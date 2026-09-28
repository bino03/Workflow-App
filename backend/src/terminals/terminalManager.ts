import { randomUUID } from 'node:crypto';
import type { IDisposable, IPty } from 'node-pty';
import type { TerminalStatus } from './protocol.js';
import { type SpawnPty, killProcessTree } from './spawnClaude.js';

export type TerminalListener = {
  onData(data: string): void;
  onExit(code: number): void;
};

export type TerminalInfo = {
  id: string;
  cwd: string;
  pid: number;
  status: TerminalStatus;
  exitCode: number | null;
  startedAt: string;
};

/** Output kept for clients that (re)connect. Trimmed in whole chunks so no UTF-8 character is split. */
class Scrollback {
  private chunks: { data: string; bytes: number }[] = [];
  private bytes = 0;

  constructor(private readonly maxBytes: number) {}

  push(data: string): void {
    const bytes = Buffer.byteLength(data);
    this.chunks.push({ data, bytes });
    this.bytes += bytes;
    while (this.bytes > this.maxBytes && this.chunks.length > 1) {
      this.bytes -= this.chunks.shift()!.bytes;
    }
  }

  toString(): string {
    return this.chunks.map((chunk) => chunk.data).join('');
  }
}

class Terminal {
  readonly listeners = new Set<TerminalListener>();
  status: TerminalStatus = 'running';
  exitCode: number | null = null;
  readonly startedAt = new Date().toISOString();
  private readonly subscriptions: IDisposable[];

  constructor(
    readonly id: string,
    readonly cwd: string,
    readonly pty: IPty,
    readonly scrollback: Scrollback,
  ) {
    this.subscriptions = [
      pty.onData((data) => {
        scrollback.push(data);
        for (const listener of this.listeners) listener.onData(data);
      }),
      pty.onExit(({ exitCode }) => {
        this.status = 'exited';
        this.exitCode = exitCode;
        for (const listener of this.listeners) listener.onExit(exitCode);
      }),
    ];
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
    this.listeners.clear();
  }

  info(): TerminalInfo {
    return {
      id: this.id,
      cwd: this.cwd,
      pid: this.pty.pid,
      status: this.status,
      exitCode: this.exitCode,
      startedAt: this.startedAt,
    };
  }
}

export type TerminalManagerOptions = {
  spawn: SpawnPty;
  maxTerminals: number;
  scrollbackBytes: number;
};

export class TerminalLimitError extends Error {
  override name = 'TerminalLimitError';
}

/**
 * Owns every PTY: the only place that creates, keeps and kills processes.
 * `cwd` must already have been validated against ALLOWED_ROOTS by the caller.
 */
export class TerminalManager {
  private readonly terminals = new Map<string, Terminal>();

  constructor(private readonly options: TerminalManagerOptions) {}

  /**
   * `id` is the saved terminal's id (state.json), kept across reopenings; a terminal that exited must be
   * killed (forgotten) before its id is used again. Only running terminals count for MAX_TERMINALS.
   */
  create({ id = randomUUID(), cwd, cols, rows, args }: { id?: string; cwd: string; cols: number; rows: number; args?: string[] }): TerminalInfo {
    if (this.terminals.has(id)) throw new Error(`terminal ${id} is already in memory`);
    const running = [...this.terminals.values()].filter((terminal) => terminal.status === 'running').length;
    if (running >= this.options.maxTerminals) {
      throw new TerminalLimitError(`MAX_TERMINALS (${this.options.maxTerminals}) reached`);
    }
    const ptyProcess = this.options.spawn({ cwd, cols, rows, args });
    const terminal = new Terminal(id, cwd, ptyProcess, new Scrollback(this.options.scrollbackBytes));
    this.terminals.set(terminal.id, terminal);
    return terminal.info();
  }

  list(): TerminalInfo[] {
    return [...this.terminals.values()].map((terminal) => terminal.info());
  }

  get(id: string): TerminalInfo | undefined {
    return this.terminals.get(id)?.info();
  }

  /** Subscribes to a terminal; returns the scrollback to replay first, and an unsubscribe function. */
  attach(id: string, listener: TerminalListener): { scrollback: string; detach: () => void } | undefined {
    const terminal = this.terminals.get(id);
    if (!terminal) return undefined;
    terminal.listeners.add(listener);
    return { scrollback: terminal.scrollback.toString(), detach: () => terminal.listeners.delete(listener) };
  }

  write(id: string, data: string | Buffer): void {
    const terminal = this.terminals.get(id);
    if (terminal?.status === 'running') terminal.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (terminal?.status === 'running') terminal.pty.resize(cols, rows);
  }

  /** Kills the process tree and forgets the terminal. */
  async kill(id: string): Promise<boolean> {
    const terminal = this.terminals.get(id);
    if (!terminal) return false;
    this.terminals.delete(id);
    if (terminal.status === 'running') await killProcessTree(terminal.pty);
    terminal.dispose();
    return true;
  }

  async killAll(): Promise<void> {
    await Promise.all([...this.terminals.keys()].map((id) => this.kill(id)));
  }
}
