import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import * as pty from 'node-pty';

const isWindows = process.platform === 'win32';

/**
 * Variables the `claude` child must never see:
 * - ANTHROPIC_* would switch Claude Code from the subscription to API billing (ADR 0002);
 * - CLAUDECODE / CLAUDE_* leak from a Claude Code session that started the backend (CLAUDE_CODE_*,
 *   CLAUDE_PID, CLAUDE_EFFORT, CLAUDE_JOB_DIR…) and make the child behave as a nested session (and carry
 *   that session's messaging token). Only CLAUDE_CONFIG_DIR is the user's own choice and goes through;
 * - the backend's own configuration: secrets, and PORT/HOST, which a dev server run by Claude would pick up.
 */
const DENIED_PREFIXES = ['ANTHROPIC_', 'CLAUDE_'];
const ALLOWED_NAMES = new Set(['CLAUDE_CONFIG_DIR']);
const DENIED_NAMES = new Set([
  'CLAUDECODE',
  'HOST',
  'PORT',
  'LOG_LEVEL',
  'APP_USERNAME',
  'APP_PASSWORD_HASH',
  'SESSION_SECRET',
  'SESSION_IDLE_HOURS',
  'SESSION_MAX_DAYS',
  'COOKIE_SECURE',
  'CORS_ALLOWED_ORIGINS',
  'ALLOWED_ROOTS',
  'DEFAULT_CWD',
  'MAX_TERMINALS',
  'SCROLLBACK_BYTES',
  'WORKFLOW_PATH',
  'DATA_DIR',
  'FRONTEND_DIST',
]);

export function isDeniedEnvName(name: string): boolean {
  // Windows environment names are case-insensitive.
  const upper = name.toUpperCase();
  if (ALLOWED_NAMES.has(upper)) return false;
  return DENIED_NAMES.has(upper) || DENIED_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

/**
 * A CLAUDE_CONFIG_DIR that is empty or relative makes Claude Code use the terminal's working folder as its
 * config dir: it writes projects/, history.jsonl and session keys into the project, and does not see the
 * user's login and settings. An empty `CLAUDE_CONFIG_DIR=` line in .env does exactly that.
 */
function usableConfigDir(value: string): boolean {
  return value.trim() !== '' && isAbsolute(value.trim());
}

/** The backend's environment minus everything in the denylist. */
export function childEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || isDeniedEnvName(name)) continue;
    if (name.toUpperCase() === 'CLAUDE_CONFIG_DIR' && !usableConfigDir(value)) continue;
    clean[name] = value;
  }
  return clean;
}

export class ClaudeBinError extends Error {
  override name = 'ClaudeBinError';
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function assertLaunchable(path: string): string {
  const ext = extname(path).toLowerCase();
  if (isWindows && (ext === '.cmd' || ext === '.bat' || ext === '.ps1')) {
    throw new ClaudeBinError(
      `CLAUDE_BIN resolved to a script (${path}); a PTY needs the real executable — install Claude Code with the native installer or point CLAUDE_BIN at claude.exe`,
    );
  }
  return path;
}

/** Resolves CLAUDE_BIN (a full path, or a name looked up on PATH like the shell would) to an executable. */
export function resolveClaudeBin(bin: string, env: NodeJS.ProcessEnv = process.env): string {
  if (isAbsolute(bin)) {
    if (!isFile(bin)) throw new ClaudeBinError(`CLAUDE_BIN not found: ${bin}`);
    return assertLaunchable(bin);
  }
  const dirs = (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean);
  const extensions = isWindows
    ? extname(bin)
      ? ['']
      : (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.toLowerCase())
    : [''];
  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = join(dir, bin + ext);
      if (isFile(candidate)) return assertLaunchable(candidate);
    }
  }
  throw new ClaudeBinError(`CLAUDE_BIN "${bin}" not found on PATH`);
}

export type SpawnOptions = {
  cwd: string;
  cols: number;
  rows: number;
  args?: string[];
};

export type SpawnPty = (options: SpawnOptions) => pty.IPty;

/** Spawns the resolved `claude` executable — fixed binary, fixed args, clean environment, never a shell. */
export function claudeSpawner(claudePath: string): SpawnPty {
  return ({ cwd, cols, rows, args = [] }) =>
    pty.spawn(claudePath, args, {
      name: 'xterm-256color',
      cwd,
      cols,
      rows,
      env: { ...childEnv(), TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });
}

const execFileAsync = promisify(execFile);

/**
 * Kills a PTY and every process below it. On Windows node-pty's kill() only takes processes attached to
 * the pseudo-console, and its helper crashes ("AttachConsole failed") once the shell is gone — so
 * `taskkill /T` does the whole tree, and kill() is only the fallback if taskkill fails.
 */
export async function killProcessTree(ptyProcess: pty.IPty): Promise<void> {
  if (isWindows) {
    try {
      await execFileAsync('taskkill', ['/PID', String(ptyProcess.pid), '/T', '/F'], { windowsHide: true });
      return;
    } catch {
      // Fall through to node-pty's own kill.
    }
  }
  try {
    ptyProcess.kill();
  } catch {
    // Already exited.
  }
}

/** Every process below `rootPid` (Windows; elsewhere the PTY's hang-up takes them). */
export async function listDescendants(rootPid: number): Promise<number[]> {
  if (!isWindows) return [];
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }'],
      { windowsHide: true },
    );
    const children = new Map<number, number[]>();
    for (const line of stdout.trim().split(/\r?\n/)) {
      const [pid, parent] = line.trim().split(' ').map(Number);
      if (pid === undefined || parent === undefined || Number.isNaN(pid) || pid === parent) continue;
      children.set(parent, [...(children.get(parent) ?? []), pid]);
    }
    const found: number[] = [];
    const stack = [rootPid];
    while (stack.length > 0) {
      for (const child of children.get(stack.pop()!) ?? []) {
        found.push(child);
        stack.push(child);
      }
    }
    return found;
  } catch {
    return [];
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ends `claude` the way a person would — Ctrl+C twice — and only forces it if it does not exit in `graceMs`.
 *
 * Why not taskkill straight away: Claude Code arms a "fullscreen boot canary" in ~/.claude.json and only clears
 * it ~10 s after the first frame or on a clean exit. A process killed before that leaves the canary behind, and
 * two of those turn the fullscreen renderer off on the whole machine ("repeatedly failed to start"). A clean
 * exit also lets it finish writing the session's .jsonl.
 *
 * The tree is still ended: the descendants are listed first (a clean exit would orphan them — a dev server
 * started by claude, say) and whatever survives is killed at the end.
 */
export async function closeGracefully(ptyProcess: pty.IPty, { graceMs }: { graceMs: number }): Promise<void> {
  let exited = false;
  const done = new Promise<void>((resolve) => {
    const subscription = ptyProcess.onExit(() => {
      exited = true;
      subscription.dispose();
      resolve();
    });
  });
  const tree = await listDescendants(ptyProcess.pid);
  try {
    ptyProcess.write('\x03');
    await Promise.race([done, new Promise((r) => setTimeout(r, 250))]);
    if (!exited) ptyProcess.write('\x03');
  } catch {
    // The PTY is already gone.
  }
  await Promise.race([done, new Promise((r) => setTimeout(r, graceMs))]);
  if (!exited) await killProcessTree(ptyProcess);
  const survivors = tree.filter(isAlive);
  if (isWindows && survivors.length > 0) {
    try {
      await execFileAsync('taskkill', ['/F', ...survivors.flatMap((pid) => ['/PID', String(pid)])], { windowsHide: true });
    } catch {
      // Some had already exited between the check and the kill.
    }
  }
}
