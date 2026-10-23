import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type ExecFile = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
) => Promise<{ stdout: string; stderr: string }>;

const execFileAsync: ExecFile = promisify(execFile);

/**
 * Why `tailscale` did not do what was asked. `enableUrl` is set when Serve is not yet enabled on the tailnet —
 * the owner has to open it once. `detail` is for the log only (the CLI's own words, never terminal content).
 */
export class TailscaleError extends Error {
  constructor(
    readonly reason: 'not-enabled' | 'unavailable',
    readonly detail: string,
    readonly enableUrl?: string,
  ) {
    super(reason === 'not-enabled' ? 'Tailscale Serve is not enabled on the tailnet' : 'Tailscale did not answer');
    this.name = 'TailscaleError';
  }
}

function assertPort(port: number): number {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError(`not a TCP port: ${port}`);
  return port;
}

/**
 * The only place that runs `TAILSCALE_BIN` (ADR 0018), and only in these forms, built here from validated
 * numbers — never `funnel`, never `serve reset`, never `up`/`set`/`login`:
 *   status --json · serve status --json · serve --bg --https=<P> http://127.0.0.1:<D> · serve --https=<P> off
 */
export class TailscaleCli {
  constructor(
    private readonly bin: string,
    private readonly exec: ExecFile = execFileAsync,
    /** With Serve not enabled the CLI never exits — it waits printing an activation link (spike 2026-10-23). */
    private readonly timeoutMs = 10_000,
  ) {}

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout, stderr } = await this.exec(this.bin, args, { timeout: this.timeoutMs, windowsHide: true });
      return `${stdout}${stderr}`;
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; message?: string };
      const output = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
      if (/Serve is not enabled on your tailnet/i.test(output)) {
        throw new TailscaleError('not-enabled', output.split('\n')[0]!.trim(), /https:\/\/login\.tailscale\.com\/\S+/.exec(output)?.[0]);
      }
      throw new TailscaleError('unavailable', output.split('\n')[0]?.trim() || (e.message ?? 'unknown error'));
    }
  }

  private async json(args: string[]): Promise<unknown> {
    const out = await this.run(args);
    try {
      return JSON.parse(out);
    } catch {
      throw new TailscaleError('unavailable', `not JSON: ${out.slice(0, 80)}`);
    }
  }

  /** This machine's MagicDNS name, without the trailing dot — the host of every preview link. */
  async hostName(): Promise<string> {
    const status = (await this.json(['status', '--json'])) as { Self?: { DNSName?: unknown } };
    const name = status.Self?.DNSName;
    if (typeof name !== 'string' || name.length === 0) throw new TailscaleError('unavailable', 'status has no Self.DNSName');
    return name.replace(/\.$/, '');
  }

  /** HTTPS ports currently served, each with the local target it proxies to ("" if it is not a simple proxy). */
  async servedPorts(): Promise<Map<number, string>> {
    const status = (await this.json(['serve', 'status', '--json'])) as {
      TCP?: Record<string, unknown>;
      Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }>;
    };
    const served = new Map<number, string>();
    for (const port of Object.keys(status.TCP ?? {})) served.set(Number(port), '');
    for (const [hostPort, web] of Object.entries(status.Web ?? {})) {
      const port = Number(hostPort.split(':').pop());
      if (served.has(port)) served.set(port, web.Handlers?.['/']?.Proxy ?? '');
    }
    return served;
  }

  /** Serves 127.0.0.1:<devPort> on https://<host>:<httpsPort> inside the tailnet; returns once it is up. */
  async serve(httpsPort: number, devPort: number): Promise<void> {
    await this.run(['serve', '--bg', `--https=${assertPort(httpsPort)}`, `http://127.0.0.1:${assertPort(devPort)}`]);
  }

  /** Stops serving `httpsPort`. Not being served counts as done ("handler does not exist" — spike). */
  async off(httpsPort: number): Promise<void> {
    try {
      await this.run(['serve', `--https=${assertPort(httpsPort)}`, 'off']);
    } catch (error) {
      if (error instanceof TailscaleError && /handler does not exist/i.test(error.detail)) return;
      throw error;
    }
  }
}
