import { AppError } from '../common/errors.js';
import type { TerminalInfo, TerminalListener } from '../terminals/terminalManager.js';
import type { DevPort } from './listeningPorts.js';
import { type TailscaleCli, TailscaleError } from './tailscale.js';

/** What the API and the bot show for a terminal's preview. */
export type TerminalPreview = { url: string; devPort: number; httpsPort: number; startedAt: string };
/** One port → it is served; several → the owner picks one (`ports`). */
export type StartPreviewResult = { preview: TerminalPreview } | { ports: DevPort[] };
export type PreviewStopReason = 'manual' | 'terminal-ended' | 'port-closed' | 'shutdown';

/** Told when a preview starts or stops, whoever asked — the Telegram bot sends the link (ADR 0018 point 5). */
export type PreviewNotifier = {
  started(terminalId: string, preview: TerminalPreview): void;
  stopped(terminalId: string, preview: TerminalPreview, reason: Exclude<PreviewStopReason, 'shutdown'>): void;
};

export type PreviewServiceDeps = {
  terminals: {
    get(id: string): TerminalInfo | undefined;
    attach(id: string, listener: TerminalListener): { detach: () => void } | undefined;
  };
  tailscale: Pick<TailscaleCli, 'hostName' | 'servedPorts' | 'serve' | 'off'>;
  /** devPortsOf, already excluding the backend's own PORT. */
  devPorts: (rootPid: number) => Promise<DevPort[]>;
  /** PREVIEW_HTTPS_PORTS: the only HTTPS ports this backend serves, and the only ones it ever turns off. */
  httpsPorts: readonly number[];
  notifier?: PreviewNotifier;
  log?: { info(obj: object, msg: string): void; warn(obj: object, msg: string): void };
  /** How often a live preview checks its dev port is still listening. Default 15 s. */
  pollMs?: number;
  now?: () => Date;
};

type Entry = TerminalPreview & { pid: number; detach: () => void };

/**
 * Dev-server previews over `tailscale serve` (ADR 0018). State lives in memory only, like the PTYs: a
 * backend restart forgets it, and `cleanupOwnPorts()` at startup turns off whatever the previous run left
 * in the Tailscale daemon (`serve --bg` outlives the process that set it).
 */
export class PreviewService {
  private readonly previews = new Map<string, Entry>();
  /** A start in flight per terminal: a second click gets the same answer instead of a second serve. */
  private readonly starting = new Map<string, Promise<StartPreviewResult>>();
  /** HTTPS ports handed to a start that has not finished yet. */
  private readonly reserved = new Set<number>();
  private readonly stopping = new Set<string>();
  private host: string | undefined;
  private timer: NodeJS.Timeout | undefined;
  private readonly now: () => Date;

  constructor(private readonly deps: PreviewServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  get(terminalId: string): TerminalPreview | undefined {
    const entry = this.previews.get(terminalId);
    return entry && publicView(entry);
  }

  /** `quiet`: do not tell the notifier — the caller (the bot) already replies with the link. */
  start(terminalId: string, devPort?: number, { quiet = false }: { quiet?: boolean } = {}): Promise<StartPreviewResult> {
    const existing = this.get(terminalId);
    if (existing) return Promise.resolve({ preview: existing });
    const inFlight = this.starting.get(terminalId);
    if (inFlight) return inFlight;
    const started = this.doStart(terminalId, devPort, quiet).finally(() => this.starting.delete(terminalId));
    this.starting.set(terminalId, started);
    return started;
  }

  private async doStart(terminalId: string, requested: number | undefined, quiet: boolean): Promise<StartPreviewResult> {
    const info = this.runningTerminal(terminalId);
    const ports = await this.deps.devPorts(info.pid);
    let devPort: number;
    if (requested !== undefined) {
      if (!ports.some((p) => p.port === requested)) throw new AppError('PREVIEW_003');
      devPort = requested;
    } else if (ports.length === 0) {
      throw new AppError('PREVIEW_001');
    } else if (ports.length > 1) {
      return { ports };
    } else {
      devPort = ports[0]!.port;
    }

    const httpsPort = this.freeHttpsPort();
    this.reserved.add(httpsPort);
    try {
      const host = await this.hostName();
      await this.tailscale(() => this.deps.tailscale.serve(httpsPort, devPort));
      // The terminal may have ended while tailscale was answering.
      const still = this.deps.terminals.get(terminalId);
      if (still?.status !== 'running' || still.pid !== info.pid) {
        await this.deps.tailscale.off(httpsPort).catch(() => undefined);
        throw new AppError('PREVIEW_002');
      }
      const preview: TerminalPreview = { url: `https://${host}:${httpsPort}/`, devPort, httpsPort, startedAt: this.now().toISOString() };
      const attached = this.deps.terminals.attach(terminalId, {
        onData: () => undefined,
        onExit: () => void this.stop(terminalId, 'terminal-ended').catch(() => undefined),
        onClose: () => void this.stop(terminalId, 'terminal-ended').catch(() => undefined),
      });
      this.previews.set(terminalId, { ...preview, pid: info.pid, detach: attached?.detach ?? (() => undefined) });
      this.ensurePolling();
      this.deps.log?.info({ terminalId, devPort, httpsPort }, 'preview started');
      if (!quiet) this.deps.notifier?.started(terminalId, preview);
      return { preview };
    } finally {
      this.reserved.delete(httpsPort);
    }
  }

  /**
   * Turns a preview off. Idempotent. A manual stop that tailscale refuses keeps the entry and throws, so it
   * can be retried; an automatic one is dropped and logged (the next startup's cleanup catches the port).
   */
  async stop(terminalId: string, reason: PreviewStopReason = 'manual', { quiet = false }: { quiet?: boolean } = {}): Promise<boolean> {
    const entry = this.previews.get(terminalId);
    if (!entry || this.stopping.has(terminalId)) return false;
    this.stopping.add(terminalId);
    try {
      try {
        await this.tailscale(() => this.deps.tailscale.off(entry.httpsPort));
      } catch (error) {
        this.deps.log?.warn({ terminalId, httpsPort: entry.httpsPort, reason, err: error }, 'preview: tailscale serve off failed');
        if (reason === 'manual') throw error;
      }
      this.previews.delete(terminalId);
      entry.detach();
      if (this.previews.size === 0) this.stopPolling();
      this.deps.log?.info({ terminalId, httpsPort: entry.httpsPort, reason }, 'preview stopped');
      if (reason !== 'shutdown' && !quiet) this.deps.notifier?.stopped(terminalId, publicView(entry), reason);
      return true;
    } finally {
      this.stopping.delete(terminalId);
    }
  }

  /** Turns off whatever is served on PREVIEW_HTTPS_PORTS — never a port outside them (the owner's own serves). */
  async cleanupOwnPorts(): Promise<number[]> {
    try {
      const served = await this.deps.tailscale.servedPorts();
      const own = this.deps.httpsPorts.filter((port) => served.has(port) && ![...this.previews.values()].some((p) => p.httpsPort === port));
      for (const port of own) await this.deps.tailscale.off(port);
      if (own.length > 0) this.deps.log?.info({ ports: own }, 'preview: turned off ports left by a previous run');
      return own;
    } catch (error) {
      this.deps.log?.warn({ err: error }, 'preview: cleanup of leftover ports failed');
      return [];
    }
  }

  /** On backend shutdown: every preview off, then whatever is left in the range. */
  async shutdown(): Promise<void> {
    this.stopPolling();
    await Promise.all([...this.previews.keys()].map((id) => this.stop(id, 'shutdown').catch(() => false)));
    await this.cleanupOwnPorts();
  }

  /** One sweep of the live previews: a dev port that stopped listening (or a terminal that is gone) ends it. */
  async checkPorts(): Promise<void> {
    for (const [terminalId, entry] of [...this.previews]) {
      const info = this.deps.terminals.get(terminalId);
      if (info?.status !== 'running' || info.pid !== entry.pid) {
        await this.stop(terminalId, 'terminal-ended').catch(() => false);
        continue;
      }
      const ports = await this.deps.devPorts(entry.pid);
      if (!ports.some((p) => p.port === entry.devPort)) await this.stop(terminalId, 'port-closed').catch(() => false);
    }
  }

  private runningTerminal(terminalId: string): TerminalInfo {
    const info = this.deps.terminals.get(terminalId);
    if (info?.status !== 'running') throw new AppError('PREVIEW_002');
    return info;
  }

  private freeHttpsPort(): number {
    const used = new Set([...this.reserved, ...[...this.previews.values()].map((p) => p.httpsPort)]);
    const free = this.deps.httpsPorts.find((port) => !used.has(port));
    if (free === undefined) throw new AppError('PREVIEW_004');
    return free;
  }

  private async hostName(): Promise<string> {
    this.host ??= await this.tailscale(() => this.deps.tailscale.hostName());
    return this.host;
  }

  /** Runs a tailscale call, turning its failures into the API's errors (the activation link included). */
  private async tailscale<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof TailscaleError)) throw error;
      this.deps.log?.warn({ reason: error.reason, detail: error.detail }, 'preview: tailscale failed');
      if (error.reason === 'not-enabled') {
        throw new AppError('PREVIEW_007', `Tailscale Serve is not enabled on the tailnet${error.enableUrl ? `: ${error.enableUrl}` : ''}`);
      }
      throw new AppError('PREVIEW_005');
    }
  }

  private ensurePolling(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.checkPorts().catch(() => undefined), this.deps.pollMs ?? 15_000);
    this.timer.unref();
  }

  private stopPolling(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}

function publicView({ url, devPort, httpsPort, startedAt }: Entry): TerminalPreview {
  return { url, devPort, httpsPort, startedAt };
}
