import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/common/errors.js';
import type { DevPort } from '../src/preview/listeningPorts.js';
import { type PreviewNotifier, PreviewService, type PreviewServiceDeps } from '../src/preview/previewService.js';
import { TailscaleError } from '../src/preview/tailscale.js';
import type { TerminalInfo, TerminalListener } from '../src/terminals/terminalManager.js';

const HOST = 'bino.tailb8eca6.ts.net';

/** Terminals in memory, with listeners we can fire (exit / close) like the TerminalManager does. */
function fakeTerminals() {
  const infos = new Map<string, TerminalInfo>();
  const listeners = new Map<string, Set<TerminalListener>>();
  return {
    add(id: string, pid: number, status: TerminalInfo['status'] = 'running') {
      infos.set(id, { id, cwd: 'C:\\p', pid, status, exitCode: null, startedAt: '2026-10-23T10:00:00.000Z' });
    },
    exit(id: string) {
      infos.set(id, { ...infos.get(id)!, status: 'exited', exitCode: 0 });
      for (const l of listeners.get(id) ?? []) l.onExit(0);
    },
    close(id: string) {
      infos.delete(id);
      for (const l of listeners.get(id) ?? []) l.onClose?.();
      listeners.delete(id);
    },
    listenerCount: (id: string) => listeners.get(id)?.size ?? 0,
    get: (id: string) => infos.get(id),
    attach(id: string, listener: TerminalListener) {
      if (!infos.has(id)) return undefined;
      const set = listeners.get(id) ?? new Set();
      set.add(listener);
      listeners.set(id, set);
      return { detach: () => set.delete(listener) };
    },
  };
}

/** The Tailscale daemon's serve table, in memory. */
function fakeTailscale(served = new Map<number, string>()) {
  const calls: string[] = [];
  let failNext: Error | undefined;
  return {
    served,
    calls,
    failNext: (error: Error) => (failNext = error),
    hostName: vi.fn(async () => HOST),
    servedPorts: async () => new Map(served),
    serve: async (https: number, dev: number) => {
      calls.push(`serve ${https} ${dev}`);
      if (failNext) throw ((e) => ((failNext = undefined), e))(failNext);
      served.set(https, `http://127.0.0.1:${dev}`);
    },
    off: async (https: number) => {
      calls.push(`off ${https}`);
      if (failNext) throw ((e) => ((failNext = undefined), e))(failNext);
      served.delete(https);
    },
  };
}

function setup(overrides: Partial<PreviewServiceDeps> = {}) {
  const terminals = fakeTerminals();
  const tailscale = fakeTailscale();
  const ports = new Map<number, DevPort[]>(); // by root pid
  const notifier = { started: vi.fn(), stopped: vi.fn() } satisfies PreviewNotifier;
  const service = new PreviewService({
    terminals,
    tailscale,
    devPorts: async (pid) => ports.get(pid) ?? [],
    httpsPorts: [8443, 8444],
    notifier,
    pollMs: 60_000,
    now: () => new Date('2026-10-23T12:00:00.000Z'),
    ...overrides,
  });
  return { service, terminals, tailscale, ports, notifier };
}

const vite: DevPort = { port: 5173, pid: 501, process: 'node.exe' };
const api: DevPort = { port: 8080, pid: 502, process: 'java.exe' };

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.catch((e: unknown) => e);
  return error instanceof AppError ? error.code : undefined;
}

describe('PreviewService.start', () => {
  it('one dev port → serves it on the first HTTPS port of the range and tells the notifier', async () => {
    const { service, terminals, tailscale, ports, notifier } = setup();
    terminals.add('t1', 100);
    ports.set(100, [vite]);
    const preview = { url: `https://${HOST}:8443/`, devPort: 5173, httpsPort: 8443, startedAt: '2026-10-23T12:00:00.000Z' };
    expect(await service.start('t1')).toEqual({ preview });
    expect(tailscale.calls).toEqual(['serve 8443 5173']);
    expect(service.get('t1')).toEqual(preview);
    expect(notifier.started).toHaveBeenCalledWith('t1', preview);
  });

  it('several dev ports → returns them to choose from, serves nothing; then the chosen one', async () => {
    const { service, terminals, tailscale, ports } = setup();
    terminals.add('t1', 100);
    ports.set(100, [vite, api]);
    expect(await service.start('t1')).toEqual({ ports: [vite, api] });
    expect(tailscale.calls).toEqual([]);
    expect(await service.start('t1', 8080)).toMatchObject({ preview: { devPort: 8080, httpsPort: 8443 } });
  });

  it('no dev port → PREVIEW_001; a port that is not listening → PREVIEW_003', async () => {
    const { service, terminals, ports } = setup();
    terminals.add('t1', 100);
    expect(await codeOf(service.start('t1'))).toBe('PREVIEW_001');
    ports.set(100, [vite]);
    expect(await codeOf(service.start('t1', 3000))).toBe('PREVIEW_003');
  });

  it('an unknown, exited or stopped terminal → PREVIEW_002', async () => {
    const { service, terminals } = setup();
    terminals.add('t1', 100, 'exited');
    expect(await codeOf(service.start('t1'))).toBe('PREVIEW_002');
    expect(await codeOf(service.start('nope'))).toBe('PREVIEW_002');
  });

  it('a second start returns the live preview; two starts at once serve once', async () => {
    const { service, terminals, tailscale, ports } = setup();
    terminals.add('t1', 100);
    ports.set(100, [vite]);
    const [a, b] = await Promise.all([service.start('t1'), service.start('t1')]);
    expect(a).toEqual(b);
    expect(await service.start('t1')).toEqual(a);
    expect(tailscale.calls).toEqual(['serve 8443 5173']);
  });

  it('two terminals get different HTTPS ports, even when started at once; a full range → PREVIEW_004', async () => {
    const { service, terminals, ports } = setup();
    for (const [id, pid] of [['t1', 100], ['t2', 200], ['t3', 300]] as const) {
      terminals.add(id, pid);
      ports.set(pid, [vite]);
    }
    const [a, b] = await Promise.all([service.start('t1'), service.start('t2')]);
    expect(new Set([a, b].map((r) => ('preview' in r ? r.preview.httpsPort : 0)))).toEqual(new Set([8443, 8444]));
    expect(await codeOf(service.start('t3'))).toBe('PREVIEW_004');
  });

  it('a terminal that ends while tailscale answers is not left served → PREVIEW_002', async () => {
    const { service, terminals, tailscale, ports } = setup();
    terminals.add('t1', 100);
    ports.set(100, [vite]);
    const serve = tailscale.serve;
    tailscale.serve = async (https, dev) => {
      await serve(https, dev);
      terminals.exit('t1');
    };
    expect(await codeOf(service.start('t1'))).toBe('PREVIEW_002');
    expect(tailscale.served.size).toBe(0);
    expect(service.get('t1')).toBeUndefined();
  });

  it('Serve not enabled → PREVIEW_007 carrying the activation link; any other failure → PREVIEW_005', async () => {
    const { service, terminals, tailscale, ports } = setup();
    terminals.add('t1', 100);
    ports.set(100, [vite]);
    tailscale.failNext(new TailscaleError('not-enabled', 'Serve is not enabled on your tailnet.', 'https://login.tailscale.com/f/serve?node=X'));
    const error = (await service.start('t1').catch((e: unknown) => e)) as AppError;
    expect(error.code).toBe('PREVIEW_007');
    expect(error.message).toContain('https://login.tailscale.com/f/serve?node=X');
    tailscale.failNext(new TailscaleError('unavailable', 'spawn ENOENT'));
    expect(await codeOf(service.start('t1'))).toBe('PREVIEW_005');
    // Nothing was reserved for good: the range is free again.
    expect(await service.start('t1')).toMatchObject({ preview: { httpsPort: 8443 } });
  });
});

describe('PreviewService.stop and the life cycle', () => {
  async function live() {
    const ctx = setup();
    ctx.terminals.add('t1', 100);
    ctx.ports.set(100, [vite]);
    await ctx.service.start('t1');
    return ctx;
  }

  it('a manual stop turns the port off, detaches and tells the notifier; twice is fine', async () => {
    const { service, terminals, tailscale, notifier } = await live();
    expect(await service.stop('t1')).toBe(true);
    expect(await service.stop('t1')).toBe(false);
    expect(tailscale.calls).toEqual(['serve 8443 5173', 'off 8443']);
    expect(terminals.listenerCount('t1')).toBe(0);
    expect(notifier.stopped).toHaveBeenCalledWith('t1', expect.objectContaining({ httpsPort: 8443 }), 'manual');
  });

  it('the terminal exiting ends the preview', async () => {
    const { service, terminals, tailscale, notifier } = await live();
    terminals.exit('t1');
    await vi.waitFor(() => expect(service.get('t1')).toBeUndefined());
    expect(tailscale.served.size).toBe(0);
    expect(notifier.stopped).toHaveBeenCalledWith('t1', expect.anything(), 'terminal-ended');
  });

  it('the terminal being closed or killed to reopen ends the preview', async () => {
    const { service, terminals, tailscale } = await live();
    terminals.close('t1');
    await vi.waitFor(() => expect(service.get('t1')).toBeUndefined());
    expect(tailscale.served.size).toBe(0);
  });

  it('the periodic check ends a preview whose dev port stopped listening', async () => {
    const { service, ports, tailscale, notifier } = await live();
    await service.checkPorts();
    expect(service.get('t1')).toBeDefined();
    ports.set(100, []);
    await service.checkPorts();
    expect(service.get('t1')).toBeUndefined();
    expect(tailscale.served.size).toBe(0);
    expect(notifier.stopped).toHaveBeenCalledWith('t1', expect.anything(), 'port-closed');
  });

  it('a manual stop that tailscale refuses keeps the preview and throws (retry); an automatic one drops it', async () => {
    const { service, tailscale, ports } = await live();
    tailscale.failNext(new TailscaleError('unavailable', 'daemon down'));
    expect(await codeOf(service.stop('t1'))).toBe('PREVIEW_005');
    expect(service.get('t1')).toBeDefined();
    tailscale.failNext(new TailscaleError('unavailable', 'daemon down'));
    ports.set(100, []);
    await service.checkPorts();
    expect(service.get('t1')).toBeUndefined();
  });
});

describe('PreviewService.cleanupOwnPorts / shutdown', () => {
  it("turns off only the ports of the range left by a previous run — never the owner's other serves", async () => {
    const { service, tailscale } = setup();
    for (const port of [443, 8443, 8444, 10000]) tailscale.served.set(port, 'http://127.0.0.1:1');
    expect(await service.cleanupOwnPorts()).toEqual([8443, 8444]);
    expect([...tailscale.served.keys()]).toEqual([443, 10000]);
  });

  it('does not throw when tailscale is down (startup must not fail)', async () => {
    const { service, tailscale } = setup();
    tailscale.servedPorts = async () => {
      throw new TailscaleError('unavailable', 'down');
    };
    expect(await service.cleanupOwnPorts()).toEqual([]);
  });

  it('shutdown turns every preview off without notifying', async () => {
    const { service, terminals, ports, tailscale, notifier } = setup();
    terminals.add('t1', 100);
    ports.set(100, [vite]);
    await service.start('t1');
    await service.shutdown();
    expect(tailscale.served.size).toBe(0);
    expect(notifier.stopped).not.toHaveBeenCalled();
  });
});
