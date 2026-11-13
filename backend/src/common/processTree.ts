import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * One process. `createdAt` (ms since the epoch) guards against recycled pids and dates a process against a Correr
 * (ADR 0032). `args`, `executablePath` and `cwd` are only read for the chains of listening processes, and are never
 * logged or returned by the API.
 */
export type ProcessRow = {
  pid: number;
  ppid: number;
  name: string;
  createdAt?: number;
  args?: string[];
  executablePath?: string;
  /** Linux only: Windows does not expose another process's working directory. */
  cwd?: string;
};

// Fixed command: nothing from the client ever reaches it (ADR 0004).
const WINDOWS_PROCESS_LIST = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.Name)" }';

/** Lines "<pid> <ppid> <name>"; the name may have spaces ("System Idle Process"). */
export function parseWindowsProcessList(stdout: string): ProcessRow[] {
  const rows: ProcessRow[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*?)\s*$/.exec(line);
    if (match) rows.push({ pid: Number(match[1]), ppid: Number(match[2]), name: match[3]! });
  }
  return rows;
}

/** Clock ticks per second of /proc/<pid>/stat's starttime: 100 on every mainstream Linux (`getconf CLK_TCK`). */
const LINUX_CLOCK_TICKS = 100;

/**
 * One /proc/<pid>/stat line: "<pid> (<comm>) <state> <ppid> …". The comm may itself contain spaces and
 * parentheses, so it ends at the LAST ')'. With the boot time (`btime` of /proc/stat, in ms) the row also gets
 * `createdAt`, from field 22 (starttime, in clock ticks since boot).
 */
export function parseLinuxStat(content: string, bootTimeMs?: number): ProcessRow | undefined {
  const open = content.indexOf('(');
  const close = content.lastIndexOf(')');
  if (open < 0 || close < open) return undefined;
  const pid = Number(content.slice(0, open).trim());
  const fields = content.slice(close + 1).trim().split(/\s+/); // fields[0] is field 3 (state)
  const ppid = fields[1];
  if (!Number.isInteger(pid) || ppid === undefined || !/^\d+$/.test(ppid)) return undefined;
  const row: ProcessRow = { pid, ppid: Number(ppid), name: content.slice(open + 1, close) };
  const start = fields[22 - 3];
  if (bootTimeMs !== undefined && start !== undefined && /^\d+$/.test(start)) {
    row.createdAt = bootTimeMs + (Number(start) * 1000) / LINUX_CLOCK_TICKS;
  }
  return row;
}

/** The `btime` line of /proc/stat (seconds since the epoch), in ms. */
export function parseLinuxBootTime(content: string): number | undefined {
  const match = /^btime\s+(\d+)\s*$/m.exec(content);
  return match ? Number(match[1]) * 1000 : undefined;
}

/** Reads every /proc/<pid>/stat. A process that exits mid-read is skipped. */
export async function readLinuxProcesses(procRoot = '/proc'): Promise<ProcessRow[]> {
  const bootTimeMs = parseLinuxBootTime(await readFile(join(procRoot, 'stat'), 'utf8').catch(() => ''));
  const pids = (await readdir(procRoot)).filter((entry) => /^\d+$/.test(entry));
  const rows = await Promise.all(
    pids.map((pid) =>
      readFile(join(procRoot, pid, 'stat'), 'utf8').then((content) => parseLinuxStat(content, bootTimeMs), () => undefined),
    ),
  );
  return rows.filter((row): row is ProcessRow => row !== undefined);
}

/** Every process on the machine, or [] if the platform's listing fails. */
export async function listProcesses(): Promise<ProcessRow[]> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_LIST], {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      });
      return parseWindowsProcessList(stdout);
    }
    return await readLinuxProcesses();
  } catch {
    return [];
  }
}

/**
 * Whether `parent` can really be `child`'s parent: a process cannot be created before its parent, so an older
 * child means the parent's pid was recycled after the real parent died. Unknown times are given the benefit.
 */
export function isRealParent(parent: ProcessRow, child: ProcessRow): boolean {
  if (parent.pid === child.pid) return false; // pid 0 on Windows is its own parent
  if (parent.createdAt === undefined || child.createdAt === undefined) return true;
  return parent.createdAt <= child.createdAt;
}

/** The processes below `rootPid` (not the root itself), depth-first. */
export function descendantsOf(rows: ProcessRow[], rootPid: number): ProcessRow[] {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const children = new Map<number, ProcessRow[]>();
  for (const row of rows) {
    if (row.pid === row.ppid) continue;
    children.set(row.ppid, [...(children.get(row.ppid) ?? []), row]);
  }
  const found: ProcessRow[] = [];
  const seen = new Set<number>([rootPid]);
  const stack = [rootPid];
  while (stack.length > 0) {
    const parentPid = stack.pop()!;
    const parent = byPid.get(parentPid);
    for (const child of children.get(parentPid) ?? []) {
      if (seen.has(child.pid)) continue; // a recycled pid can close a loop
      if (parent && !isRealParent(parent, child)) continue; // an orphan whose dead parent's pid was reused
      seen.add(child.pid);
      found.push(child);
      stack.push(child.pid);
    }
  }
  return found;
}

/**
 * Kills one process and what is below it, by pid — never by name (ADR 0032 point 3). `taskkill /T /F` on Windows,
 * SIGKILL elsewhere. A pid that is already gone is not an error.
 */
export async function killProcessById(pid: number): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 0) return; // 0 would be "my own process group"
  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // Already exited.
  }
}

/** The pids of every process below `rootPid`. */
export async function listDescendants(rootPid: number): Promise<number[]> {
  return descendantsOf(await listProcesses(), rootPid).map((row) => row.pid);
}
