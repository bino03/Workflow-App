import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ProcessRow = { pid: number; ppid: number; name: string };

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

/**
 * One /proc/<pid>/stat line: "<pid> (<comm>) <state> <ppid> …". The comm may itself contain spaces and
 * parentheses, so it ends at the LAST ')'.
 */
export function parseLinuxStat(content: string): ProcessRow | undefined {
  const open = content.indexOf('(');
  const close = content.lastIndexOf(')');
  if (open < 0 || close < open) return undefined;
  const pid = Number(content.slice(0, open).trim());
  const [, ppid] = content.slice(close + 1).trim().split(/\s+/);
  if (!Number.isInteger(pid) || ppid === undefined || !/^\d+$/.test(ppid)) return undefined;
  return { pid, ppid: Number(ppid), name: content.slice(open + 1, close) };
}

/** Reads every /proc/<pid>/stat. A process that exits mid-read is skipped. */
export async function readLinuxProcesses(procRoot = '/proc'): Promise<ProcessRow[]> {
  const pids = (await readdir(procRoot)).filter((entry) => /^\d+$/.test(entry));
  const rows = await Promise.all(
    pids.map((pid) =>
      readFile(join(procRoot, pid, 'stat'), 'utf8').then(parseLinuxStat, () => undefined),
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

/** The processes below `rootPid` (not the root itself), depth-first. */
export function descendantsOf(rows: ProcessRow[], rootPid: number): ProcessRow[] {
  const children = new Map<number, ProcessRow[]>();
  for (const row of rows) {
    if (row.pid === row.ppid) continue; // pid 0 on Windows is its own parent
    children.set(row.ppid, [...(children.get(row.ppid) ?? []), row]);
  }
  const found: ProcessRow[] = [];
  const seen = new Set<number>([rootPid]);
  const stack = [rootPid];
  while (stack.length > 0) {
    for (const child of children.get(stack.pop()!) ?? []) {
      if (seen.has(child.pid)) continue; // a recycled pid can close a loop
      seen.add(child.pid);
      found.push(child);
      stack.push(child.pid);
    }
  }
  return found;
}

/** The pids of every process below `rootPid`. */
export async function listDescendants(rootPid: number): Promise<number[]> {
  return descendantsOf(await listProcesses(), rootPid).map((row) => row.pid);
}
