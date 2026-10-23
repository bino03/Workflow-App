import { execFile } from 'node:child_process';
import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { descendantsOf, listProcesses } from '../common/processTree.js';

const execFileAsync = promisify(execFile);

/** A TCP port a terminal's process tree is listening on, as offered for a preview (ADR 0018). */
export type DevPort = { port: number; pid: number; process: string };
export type Listener = { address: string; port: number; pid: number };

/** Never offered: the Node inspector. The backend's own PORT is added by the caller. */
const ALWAYS_EXCLUDED = [9229];

// Fixed command: nothing from the client ever reaches it (ADR 0004).
const WINDOWS_LISTENERS =
  'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { "$($_.LocalAddress) $($_.LocalPort) $($_.OwningProcess)" }';

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

async function listListeners(pids: number[]): Promise<Listener[]> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_LISTENERS], {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      });
      return parseWindowsListeners(stdout);
    }
    return await readLinuxListeners(pids);
  } catch {
    return [];
  }
}

/**
 * The ports a preview could serve: listening, reachable from 127.0.0.1, owned by a process below `rootPid`
 * (the terminal's `claude`), one entry per port, lowest first. Read from the OS — never from the terminal's
 * screen (ADR 0004 rule 6).
 */
export async function devPortsOf(rootPid: number, { exclude = [] }: { exclude?: number[] } = {}): Promise<DevPort[]> {
  const below = descendantsOf(await listProcesses(), rootPid);
  if (below.length === 0) return [];
  const names = new Map(below.map((row) => [row.pid, row.name]));
  const excluded = new Set([...ALWAYS_EXCLUDED, ...exclude]);
  const byPort = new Map<number, DevPort>();
  for (const listener of await listListeners([...names.keys()])) {
    if (!names.has(listener.pid) || !isLoopbackOrAny(listener.address) || excluded.has(listener.port)) continue;
    if (!byPort.has(listener.port)) byPort.set(listener.port, { port: listener.port, pid: listener.pid, process: names.get(listener.pid)! });
  }
  return [...byPort.values()].sort((a, b) => a.port - b.port);
}
