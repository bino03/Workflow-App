import { describe, expect, it } from 'vitest';
import { type ExecFile, TailscaleCli, TailscaleError } from '../src/preview/tailscale.js';

/** The only argument shapes ADR 0018 allows. */
const ALLOWED = [
  /^status --json$/,
  /^serve status --json$/,
  /^serve --bg --https=\d{1,5} http:\/\/127\.0\.0\.1:\d{1,5}$/,
  /^serve --https=\d{1,5} off$/,
];

type Reply = { stdout?: string; stderr?: string; fail?: { stdout?: string; stderr?: string; message?: string } };

/** A fake execFile: records every call, refuses any shape outside ADR 0018, answers by the joined args. */
function fakeExec(replies: Record<string, Reply> = {}) {
  const calls: { file: string; args: string[]; timeout: number }[] = [];
  const exec: ExecFile = async (file, args, options) => {
    const line = args.join(' ');
    if (!ALLOWED.some((shape) => shape.test(line))) throw new Error(`ADR 0018 forbids: ${line}`);
    calls.push({ file, args, timeout: options.timeout });
    const reply = replies[line] ?? {};
    if (reply.fail) throw Object.assign(new Error(reply.fail.message ?? 'Command failed'), reply.fail);
    return { stdout: reply.stdout ?? '', stderr: reply.stderr ?? '' };
  };
  return { exec, calls };
}

const BIN = 'C:\\Program Files\\Tailscale\\tailscale.exe';

describe('TailscaleCli', () => {
  it('serves 127.0.0.1:<dev> on the given HTTPS port, with the fixed binary and a timeout', async () => {
    const { exec, calls } = fakeExec();
    await new TailscaleCli(BIN, exec, 10_000).serve(8443, 5173);
    expect(calls).toEqual([{ file: BIN, args: ['serve', '--bg', '--https=8443', 'http://127.0.0.1:5173'], timeout: 10_000 }]);
  });

  it('refuses anything that is not a TCP port before it reaches the argv', async () => {
    const { exec, calls } = fakeExec();
    const cli = new TailscaleCli(BIN, exec);
    for (const bad of [0, 65536, 8443.5, Number.NaN, -1]) {
      await expect(cli.serve(bad, 5173)).rejects.toThrow(RangeError);
      await expect(cli.serve(8443, bad)).rejects.toThrow(RangeError);
      await expect(cli.off(bad)).rejects.toThrow(RangeError);
    }
    expect(calls).toEqual([]);
  });

  it('reads the MagicDNS name without the trailing dot (real status --json shape)', async () => {
    const { exec } = fakeExec({ 'status --json': { stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: 'bino.tailb8eca6.ts.net.' } }) } });
    expect(await new TailscaleCli(BIN, exec).hostName()).toBe('bino.tailb8eca6.ts.net');
  });

  it('fails as unavailable when status has no name or is not JSON', async () => {
    await expect(new TailscaleCli(BIN, fakeExec({ 'status --json': { stdout: '{"Self":{}}' } }).exec).hostName()).rejects.toMatchObject({ reason: 'unavailable' });
    await expect(new TailscaleCli(BIN, fakeExec({ 'status --json': { stdout: 'Tailscale is stopped.' } }).exec).hostName()).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('lists the served HTTPS ports and what each proxies to (real serve status --json shape)', async () => {
    const status = {
      TCP: { '8443': { HTTPS: true }, '9443': { HTTPS: true } },
      Web: {
        'bino.tailb8eca6.ts.net:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:5199' } } },
        'bino.tailb8eca6.ts.net:9443': { Handlers: { '/files': { Path: 'C:\\x' } } },
      },
    };
    const { exec } = fakeExec({ 'serve status --json': { stdout: JSON.stringify(status) } });
    expect(await new TailscaleCli(BIN, exec).servedPorts()).toEqual(new Map([[8443, 'http://127.0.0.1:5199'], [9443, '']]));
    const empty = fakeExec({ 'serve status --json': { stdout: '{}' } });
    expect(await new TailscaleCli(BIN, empty.exec).servedPorts()).toEqual(new Map());
  });

  it('treats "off" on a port that is not served as done (real CLI message)', async () => {
    const { exec } = fakeExec({
      'serve --https=8443 off': { fail: { stderr: 'error: failed to remove web serve: handler does not exist\n\ntry `tailscale serve --help` for usage info' } },
    });
    await expect(new TailscaleCli(BIN, exec).off(8443)).resolves.toBeUndefined();
  });

  it('recognises "Serve is not enabled" on a timed-out call and keeps the activation link (real CLI output)', async () => {
    const { exec } = fakeExec({
      'serve --bg --https=8443 http://127.0.0.1:5199': {
        fail: {
          message: 'Command failed (killed)',
          stdout: '\nServe is not enabled on your tailnet.\nTo enable, visit:\n\n         https://login.tailscale.com/f/serve?node=n8JL2ct6wB11CNTRL\n',
        },
      },
    });
    const error = await new TailscaleCli(BIN, exec).serve(8443, 5199).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TailscaleError);
    expect(error).toMatchObject({ reason: 'not-enabled', enableUrl: 'https://login.tailscale.com/f/serve?node=n8JL2ct6wB11CNTRL' });
  });

  it('any other failure is unavailable, with the CLI first line as the log detail and no binary path in the message', async () => {
    const { exec } = fakeExec({ 'serve status --json': { fail: { message: `spawn ${BIN} ENOENT` } } });
    const error = (await new TailscaleCli(BIN, exec).servedPorts().catch((e: unknown) => e)) as TailscaleError;
    expect(error.reason).toBe('unavailable');
    expect(error.message).not.toContain(BIN);
    expect(error.detail).toContain('ENOENT');
  });
});
