import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import * as pty from 'node-pty';

const isWindows = process.platform === 'win32';

/**
 * Variables the `claude` child must never see:
 * - ANTHROPIC_* would switch Claude Code from the subscription to API billing (ADR 0002);
 * - CLAUDECODE / CLAUDE_CODE_* / CLAUDE_PID leak from a Claude Code session that started the backend
 *   and make the child behave as a nested session (and carry that session's messaging token);
 * - the backend's own configuration: secrets, and PORT/HOST, which a dev server run by Claude would pick up.
 */
const DENIED_PREFIXES = ['ANTHROPIC_', 'CLAUDE_CODE_'];
const DENIED_NAMES = new Set([
  'CLAUDECODE',
  'CLAUDE_PID',
  'HOST',
  'PORT',
  'LOG_LEVEL',
  'APP_PASSWORD_HASH',
  'SESSION_SECRET',
  'SESSION_IDLE_HOURS',
  'SESSION_MAX_DAYS',
  'COOKIE_SECURE',
  'CORS_ALLOWED_ORIGINS',
  'CLAUDE_BIN',
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
  return DENIED_NAMES.has(upper) || DENIED_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

/** The backend's environment minus everything in the denylist. */
export function childEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && !isDeniedEnvName(name)) clean[name] = value;
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
