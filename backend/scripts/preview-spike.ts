/**
 * Manual spike (step 1 of docs/features/pre-visualizacao.md, ADR 0018): can the backend drive
 * `tailscale serve` for a dev server, and find that dev server's port from a terminal's process tree?
 *
 *   A. serve --bg --https=<P> http://127.0.0.1:<D> for each <P> (no elevation? which ports?) and the time it takes
 *   B. serve status --json / status --json shapes (Self.DNSName)
 *   C. HTTPS through the tailnet name: first request (certificate) vs second
 *   D. serve --https=<P> off, and off on a port that is not served (idempotent?)
 *   E. ancestry of the process listening on <D> — is it a descendant of <root pid>?
 *
 *   npx tsx scripts/preview-spike.ts --dev 5199 [--https 8443,8444,9443] [--root <pid of claude>]
 *
 * Needs something listening on 127.0.0.1:<dev>. Turns off every <P> it turned on. Windows only (E uses CIM).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dev = Number(arg('dev') ?? 5199);
const httpsPorts = (arg('https') ?? '8443,8444,9443').split(',').map(Number);
const root = arg('root') ? Number(arg('root')) : undefined;
const bin = process.env.TAILSCALE_BIN || 'C:\\Program Files\\Tailscale\\tailscale.exe';
const log = (line: string) => console.log(line);

async function tailscale(argv: string[], timeoutMs = 15_000) {
  const started = Date.now();
  try {
    const { stdout, stderr } = await run(bin, argv, { timeout: timeoutMs, windowsHide: true });
    return { ok: true, ms: Date.now() - started, out: `${stdout}${stderr}`.trim() };
  } catch (error) {
    const e = error as { code?: number | string; killed?: boolean; stdout?: string; stderr?: string };
    return { ok: false, ms: Date.now() - started, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim(), code: e.code, killed: e.killed };
  }
}

const status = await tailscale(['status', '--json']);
const host = (JSON.parse(status.out).Self.DNSName as string).replace(/\.$/, '');
log(`B. status --json → Self.DNSName = ${host}`);

for (const port of httpsPorts) {
  const r = await tailscale(['serve', '--bg', `--https=${port}`, `http://127.0.0.1:${dev}`]);
  log(`A. serve --https=${port} → ok=${r.ok} ${r.ms} ms${r.ok ? '' : ` (killed=${r.killed}) ${r.out}`}`);
}
const serveStatus = await tailscale(['serve', 'status', '--json']);
log(`B. serve status --json → TCP ports ${Object.keys(JSON.parse(serveStatus.out).TCP ?? {}).join(', ')}`);

for (const label of ['first', 'second']) {
  const started = Date.now();
  const res = await fetch(`https://${host}:${httpsPorts[0]}/`).catch((e: Error) => e);
  log(`C. ${label} HTTPS request → ${res instanceof Error ? res.message : res.status} in ${Date.now() - started} ms`);
}

for (const port of httpsPorts) {
  const r = await tailscale(['serve', `--https=${port}`, 'off']);
  log(`D. off ${port} → ok=${r.ok}`);
}
const again = await tailscale(['serve', `--https=${httpsPorts[0]}`, 'off']);
log(`D. off ${httpsPorts[0]} again → ok=${again.ok} code=${again.code} "${again.out.split('\n')[0]}"`);

const ps = await run(
  'powershell',
  ['-NoProfile', '-NonInteractive', '-Command', `(Get-NetTCPConnection -LocalPort ${dev} -State Listen | Select-Object -First 1).OwningProcess; Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.Name)" }`],
  { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
);
const [listener, ...rows] = ps.stdout.trim().split(/\r?\n/);
const parent = new Map(rows.map((row) => {
  const [pid, ppid, ...name] = row.trim().split(' ');
  return [Number(pid), { ppid: Number(ppid), name: name.join(' ') }];
}));
const chain: string[] = [];
let pid = Number(listener);
while (parent.has(pid) && chain.length < 20) {
  chain.push(`${pid} ${parent.get(pid)!.name}`);
  if (pid === root) break;
  pid = parent.get(pid)!.ppid;
}
log(`E. listener of ${dev}: ${chain.join(' <- ')}`);
if (root) log(`E. descendant of ${root}? ${chain.some((c) => c.startsWith(`${root} `))}`);
