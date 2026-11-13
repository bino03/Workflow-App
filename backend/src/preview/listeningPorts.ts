import { execFile } from 'node:child_process';
import * as fsPromises from 'node:fs/promises';
import { join, posix, win32 } from 'node:path';
import { promisify } from 'node:util';
import { type ProcessRow, descendantsOf, isRealParent, readLinuxProcesses } from '../common/processTree.js';

const execFileAsync = promisify(execFile);

/** A TCP port a terminal's (or a project's) processes are listening on (ADR 0018, ADR 0032). */
export type DevPort = { port: number; pid: number; process: string };
export type Listener = { address: string; port: number; pid: number };

/**
 * Whose ports to look for. `rootPid`: the terminal's pid — its descendants always count. `owner`: also the processes
 * of the project folder `path` created since `since` (ADR 0032 point 1) — `always` for an app run, `no-descendants`
 * (only when nothing below the terminal listens) for a preview.
 */
export type DevPortQuery = {
  rootPid?: number;
  owner?: { path: string; since: Date; when: 'always' | 'no-descendants' };
};

/** One read of the OS: every process (args only for the listeners' chains) and every listener. */
export type Snapshot = { processes: ProcessRow[]; listeners: Listener[] };

type Platform = 'win32' | 'posix';

/** Never offered: the Node inspector. The backend's own PORT is added by the caller. */
const ALWAYS_EXCLUDED = [9229];

/** How far up from a listening process its parents are read and checked — as in the /stop skill's Step 3. */
const MAX_CHAIN = 8;

/**
 * Room for the clocks, and no more: `since` is taken after the terminal is up, so whatever its `claude` starts is
 * later anyway. A wider window adopts strangers — 5 s let the verification scenario's own Chrome in (its parent
 * `node` had the project path among its arguments and started 3 s before the Correr), and Parar killed it.
 */
const OWNER_SLACK_MS = 1_000;

/**
 * Fixed command (ADR 0004): the listeners, every process with its parent, name and creation time, and the command
 * line and executable only of each listener and its parents (MAX_CHAIN up) — one PowerShell per poll. Rows are
 * arrays to keep the JSON small: [pid, ppid, name, createdMs] or [pid, ppid, name, createdMs, commandLine, exe].
 */
const WINDOWS_SNAPSHOT = [
  '$ls = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { ,@("$($_.LocalAddress)", [int]$_.LocalPort, [int]$_.OwningProcess) })',
  '$ps = @(Get-CimInstance Win32_Process)',
  '$by = @{}; foreach ($x in $ps) { $by[[int]$x.ProcessId] = $x }',
  '$mark = @{}',
  `foreach ($l in $ls) { $id = $l[2]; for ($i = 0; $i -le ${MAX_CHAIN} -and $by.ContainsKey($id) -and -not $mark.ContainsKey($id); $i++) { $mark[$id] = 1; $id = [int]$by[$id].ParentProcessId } }`,
  '$rows = foreach ($x in $ps) { $id = [int]$x.ProcessId; $t = 0; if ($x.CreationDate) { $t = [long]([DateTimeOffset]$x.CreationDate).ToUnixTimeMilliseconds() }; if ($mark.ContainsKey($id)) { ,@($id, [int]$x.ParentProcessId, "$($x.Name)", $t, "$($x.CommandLine)", "$($x.ExecutablePath)") } else { ,@($id, [int]$x.ParentProcessId, "$($x.Name)", $t) } }',
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  'ConvertTo-Json -Compress -Depth 3 @{ l = $ls; p = @($rows) }',
].join('; ');

/**
 * `tailscale serve` proxies to 127.0.0.1, so only sockets bound to loopback or to every address can be
 * reached. One bound to the LAN or tailnet address alone cannot.
 */
export function isLoopbackOrAny(address: string): boolean {
  const a = address.toLowerCase();
  return a === '0.0.0.0' || a === '::' || a === '::1' || a.startsWith('127.') || a.startsWith('::ffff:127.');
}

/** Lines "<address> <port> <pid>" from Get-NetTCPConnection. */
export function parseWindowsListeners(stdout: string): Listener[] {
  const listeners: Listener[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*(\S+)\s+(\d+)\s+(\d+)\s*$/.exec(line);
    if (match) listeners.push({ address: match[1]!, port: Number(match[2]), pid: Number(match[3]) });
  }
  return listeners;
}

/** A Windows command line split into arguments: whitespace separates, double quotes group and are dropped. */
export function splitCommandLine(commandLine: string): string[] {
  const args: string[] = [];
  let current = '';
  let quoted = false;
  let started = false;
  for (const ch of commandLine) {
    if (ch === '"') {
      quoted = !quoted;
      started = true;
    } else if (!quoted && /\s/.test(ch)) {
      if (started) args.push(current);
      current = '';
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}

/** The JSON WINDOWS_SNAPSHOT prints. Anything malformed is dropped rather than trusted. */
export function parseWindowsSnapshot(stdout: string): Snapshot {
  let json: { l?: unknown; p?: unknown };
  try {
    json = JSON.parse(stdout.charCodeAt(0) === 0xfeff ? stdout.slice(1) : stdout) as { l?: unknown; p?: unknown };
  } catch {
    return { processes: [], listeners: [] };
  }
  const listeners: Listener[] = [];
  for (const l of Array.isArray(json.l) ? json.l : []) {
    if (Array.isArray(l) && typeof l[0] === 'string' && Number.isInteger(l[1]) && Number.isInteger(l[2])) {
      listeners.push({ address: l[0], port: l[1] as number, pid: l[2] as number });
    }
  }
  const processes: ProcessRow[] = [];
  for (const p of Array.isArray(json.p) ? json.p : []) {
    if (!Array.isArray(p) || !Number.isInteger(p[0]) || !Number.isInteger(p[1])) continue;
    const row: ProcessRow = { pid: p[0] as number, ppid: p[1] as number, name: String(p[2] ?? '') };
    if (typeof p[3] === 'number' && p[3] > 0) row.createdAt = p[3];
    if (typeof p[4] === 'string' && p[4]) row.args = splitCommandLine(p[4]);
    if (typeof p[5] === 'string' && p[5]) row.executablePath = p[5];
    processes.push(row);
  }
  return { processes, listeners };
}

/** /proc/net/tcp* store each 32-bit word of the address in host (little-endian) byte order. */
function decodeHexAddress(hex: string): string {
  const words = hex.match(/.{8}/g) ?? [];
  const bytes = words.flatMap((word) => (word.match(/../g) ?? []).reverse().map((b) => parseInt(b, 16)));
  if (bytes.length === 4) return bytes.join('.');
  const groups = Array.from({ length: 8 }, (_, i) => (bytes[2 * i]! << 8) | bytes[2 * i + 1]!);
  if (groups.every((g) => g === 0)) return '::';
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return '::1';
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) return `::ffff:${bytes.slice(12).join('.')}`;
  return groups.map((g) => g.toString(16)).join(':');
}

/** The LISTEN rows (state 0A) of /proc/net/tcp or tcp6. */
export function parseLinuxTcpTable(content: string): { address: string; port: number; inode: string }[] {
  const rows: { address: string; port: number; inode: string }[] = [];
  for (const line of content.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 10 || cols[3] !== '0A') continue;
    const [addressHex, portHex] = cols[1]!.split(':');
    if (!addressHex || !portHex) continue;
    rows.push({ address: decodeHexAddress(addressHex), port: parseInt(portHex, 16), inode: cols[9]! });
  }
  return rows;
}

export type ProcFs = {
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  readdir(path: string): Promise<string[]>;
  readlink(path: string): Promise<string>;
};

/** Listening sockets owned by `pids`: the socket inodes in /proc/net/tcp* matched to /proc/<pid>/fd links. */
export async function readLinuxListeners(pids: number[], fs: ProcFs = fsPromises, procRoot = '/proc'): Promise<Listener[]> {
  const sockets = new Map<string, { address: string; port: number }>();
  for (const table of ['tcp', 'tcp6']) {
    const content = await fs.readFile(join(procRoot, 'net', table), 'utf8').catch(() => '');
    for (const row of parseLinuxTcpTable(content)) sockets.set(row.inode, row);
  }
  const listeners: Listener[] = [];
  for (const pid of pids) {
    const fdDir = join(procRoot, String(pid), 'fd');
    const fds = await fs.readdir(fdDir).catch(() => [] as string[]);
    for (const fd of fds) {
      const link = await fs.readlink(join(fdDir, fd)).catch(() => '');
      const inode = /^socket:\[(\d+)\]$/.exec(link)?.[1];
      const socket = inode ? sockets.get(inode) : undefined;
      if (socket) listeners.push({ address: socket.address, port: socket.port, pid });
    }
  }
  return listeners;
}

/** The pids of `pid` and its real parents, MAX_CHAIN up. */
function chainOf(byPid: Map<number, ProcessRow>, pid: number): number[] {
  const chain: number[] = [];
  let row = byPid.get(pid);
  while (row && chain.length <= MAX_CHAIN && !chain.includes(row.pid)) {
    chain.push(row.pid);
    const parent = byPid.get(row.ppid);
    row = parent && isRealParent(parent, row) ? parent : undefined;
  }
  return chain;
}

/**
 * Linux: the processes (with creation time), the listeners of the pids `pidsFor` picks (all of them for a project
 * query), and the args and cwd of each listener's chain.
 */
export async function readLinuxSnapshot(
  pidsFor: (processes: ProcessRow[]) => number[],
  fs: ProcFs = fsPromises,
  procRoot = '/proc',
  readProcesses: () => Promise<ProcessRow[]> = () => readLinuxProcesses(procRoot),
): Promise<Snapshot> {
  const processes = await readProcesses();
  const listeners = await readLinuxListeners(pidsFor(processes), fs, procRoot);
  const byPid = new Map(processes.map((row) => [row.pid, row]));
  const chains = new Set(listeners.flatMap((l) => chainOf(byPid, l.pid)));
  await Promise.all(
    [...chains].map(async (pid) => {
      const row = byPid.get(pid)!;
      const cmdline = await fs.readFile(join(procRoot, String(pid), 'cmdline'), 'utf8').catch(() => '');
      const args = cmdline.split('\0').filter((arg) => arg !== '');
      if (args.length > 0) row.args = args;
      const cwd = await fs.readlink(join(procRoot, String(pid), 'cwd')).catch(() => '');
      if (cwd) row.cwd = cwd;
    }),
  );
  return { processes, listeners };
}

async function readSnapshot(query: DevPortQuery): Promise<Snapshot> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_SNAPSHOT], {
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
      return parseWindowsSnapshot(stdout);
    }
    return await readLinuxSnapshot((processes) => {
      if (query.owner) return processes.map((row) => row.pid);
      return query.rootPid && query.rootPid > 0 ? descendantsOf(processes, query.rootPid).map((row) => row.pid) : [];
    });
  } catch {
    return { processes: [], listeners: [] };
  }
}

function normalizePath(path: string, platform: Platform): string {
  if (platform === 'win32') return win32.normalize(path.replace(/\//g, '\\')).replace(/\\+$/, '').toLowerCase();
  return posix.normalize(path).replace(/\/+$/, '');
}

/** `candidate` is `root` or inside it — on a path boundary, so "app" does not match "app-x". Relative never matches. */
function isWithin(candidate: string, root: string, platform: Platform): boolean {
  const absolute = platform === 'win32' ? win32.isAbsolute(candidate) && /^[a-z]:|^\\\\/i.test(candidate) : posix.isAbsolute(candidate);
  if (!absolute) return false;
  const c = normalizePath(candidate, platform);
  const r = normalizePath(root, platform);
  return c === r || c.startsWith(r + (platform === 'win32' ? '\\' : '/'));
}

/**
 * Whether a process carries the project folder (ADR 0032 point 1): an argument (or the value of `--x=<path>`), the
 * executable, or — Linux — the working directory is the folder or inside it.
 */
export function carriesPath(row: ProcessRow, path: string, platform: Platform): boolean {
  const candidates: string[] = [];
  if (row.executablePath) candidates.push(row.executablePath);
  if (row.cwd) candidates.push(row.cwd);
  for (const arg of row.args ?? []) {
    candidates.push(arg);
    const eq = arg.indexOf('=');
    if (eq > 0) candidates.push(arg.slice(eq + 1));
  }
  return candidates.some((candidate) => isWithin(candidate, path, platform));
}

/**
 * Whether the listening process `pid` belongs to the project (ADR 0032 point 1): it or a parent (MAX_CHAIN up)
 * carries the folder, and every process on the way was created since `since`. The walk stops at a recycled pid (a
 * parent younger than its child) and at anything older than `since` — an editor opened on the folder before the
 * Correr cannot adopt a server.
 */
export function belongsToProject(
  byPid: Map<number, ProcessRow>,
  pid: number,
  owner: { path: string; since: Date },
  platform: Platform,
): boolean {
  const since = owner.since.getTime() - OWNER_SLACK_MS;
  let row = byPid.get(pid);
  for (let depth = 0; row && depth <= MAX_CHAIN; depth++) {
    if (row.createdAt === undefined || row.createdAt < since) return false;
    if (carriesPath(row, owner.path, platform)) return true;
    const parent = byPid.get(row.ppid);
    if (!parent || !isRealParent(parent, row)) return false;
    row = parent;
  }
  return false;
}

/**
 * The ports for `query` in one snapshot: listening, reachable from 127.0.0.1, not excluded, one entry per port, lowest
 * first. Below the terminal always; the project's own processes too when `owner` says so.
 */
export function selectDevPorts(
  snapshot: Snapshot,
  query: DevPortQuery,
  { exclude = [], platform = process.platform === 'win32' ? 'win32' : 'posix' }: { exclude?: number[]; platform?: Platform } = {},
): DevPort[] {
  const byPid = new Map(snapshot.processes.map((row) => [row.pid, row]));
  const rootPid = query.rootPid && query.rootPid > 0 ? query.rootPid : undefined;
  const below = new Set(rootPid ? descendantsOf(snapshot.processes, rootPid).map((row) => row.pid) : []);
  const excluded = new Set([...ALWAYS_EXCLUDED, ...exclude]);
  const usable = snapshot.listeners.filter((l) => byPid.has(l.pid) && isLoopbackOrAny(l.address) && !excluded.has(l.port));
  let chosen = usable.filter((l) => below.has(l.pid));
  const { owner } = query;
  if (owner && (owner.when === 'always' || chosen.length === 0)) {
    chosen = chosen.concat(usable.filter((l) => !below.has(l.pid) && belongsToProject(byPid, l.pid, owner, platform)));
  }
  const byPort = new Map<number, DevPort>();
  for (const l of chosen) {
    if (!byPort.has(l.port)) byPort.set(l.port, { port: l.port, pid: l.pid, process: byPid.get(l.pid)!.name });
  }
  return [...byPort.values()].sort((a, b) => a.port - b.port);
}

/**
 * The dev ports of a terminal and/or a project folder (ADR 0018, ADR 0032), read from the OS — never from the
 * terminal's screen (ADR 0004 rule 6).
 */
export async function devPortsOf(query: DevPortQuery, { exclude = [] }: { exclude?: number[] } = {}): Promise<DevPort[]> {
  if (!(query.rootPid && query.rootPid > 0) && !query.owner) return [];
  return selectDevPorts(await readSnapshot(query), query, { exclude });
}
