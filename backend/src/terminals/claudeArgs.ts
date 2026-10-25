import { basename, dirname, isAbsolute } from 'node:path';
import { isUuid } from '../sessions/claudeSessions.js';

/**
 * The only place that builds the `claude` command line (ADR 0012). Nothing the client sends becomes an
 * argument except a session UUID, and only after it passes the UUID check — so no text can turn into a
 * flag or a second command. node-pty launches the binary directly, without a shell.
 */
export type ClaudeLaunch =
  /** A new conversation, with the UUID the backend chose — so it is known before the process starts. */
  | { kind: 'new'; sessionId: string }
  /** An existing conversation: resume, "continue the last one" and reopen all end here. */
  | { kind: 'resume'; sessionId: string }
  /**
   * A new conversation whose first message is `/import <requestPath>` (ADR 0019) — interactive, not `-p`.
   * The path is the backend's own `DATA_DIR/imports/<uuid>/request.json`; the user's answers are inside it.
   */
  | { kind: 'import'; sessionId: string; requestPath: string };

export type ClaudeArgsOptions = {
  /** DATA_DIR/claude-settings.json (or the imports' one), written by the backend. Omitted → no --settings. */
  settingsPath?: string;
  /** Remote Control (ADR 0017). `name` omitted → Claude Code's automatic name. */
  remoteControl?: { name?: string };
  /** Extra folders claude may read without asking (ADR 0019): absolute paths the backend resolved. */
  addDirs?: string[];
};

/**
 * A Remote Control session name: built by the backend (project · conversation title), never typed by a client.
 * Starts with a letter or digit, so it can never read as a flag; no quotes, `$`, newlines or other controls.
 */
export const REMOTE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._\-()·]{0,79}$/u;

/** No control characters, quotes or shell-ish punctuation: the path also becomes text claude reads. */
const SAFE_PATH = /^[^\p{Cc}"'`$<>|&;*?]+$/u;

export class ClaudeArgsError extends Error {
  override name = 'ClaudeArgsError';
}

function assertSafeAbsolute(path: string, what: string): void {
  if (!isAbsolute(path) || !SAFE_PATH.test(path) || path.startsWith('-')) {
    throw new ClaudeArgsError(`${what} must be an absolute path without control characters or quotes`);
  }
}

/** `<anything>/<uuid>/request.json`, nothing else. */
function assertRequestPath(path: string): void {
  assertSafeAbsolute(path, 'request path');
  if (basename(path) !== 'request.json' || !isUuid(basename(dirname(path)))) {
    throw new ClaudeArgsError('request path must be <imports>/<uuid>/request.json');
  }
}

export function claudeArgs(launch: ClaudeLaunch, { settingsPath, remoteControl, addDirs = [] }: ClaudeArgsOptions = {}): string[] {
  if (!isUuid(launch.sessionId)) throw new ClaudeArgsError('session id must be a UUID');
  // --add-dir takes several values: first, so the next flag ends it (confirmed in the import spike).
  const args: string[] = [];
  if (addDirs.length > 0) {
    for (const dir of addDirs) assertSafeAbsolute(dir, 'add-dir');
    args.push('--add-dir', ...addDirs);
  }
  args.push(...(launch.kind === 'resume' ? ['--resume', launch.sessionId] : ['--session-id', launch.sessionId]));
  if (settingsPath !== undefined) {
    if (!isAbsolute(settingsPath)) throw new ClaudeArgsError('settings path must be absolute');
    args.push('--settings', settingsPath);
  }
  if (launch.kind === 'import') {
    if (remoteControl) throw new ClaudeArgsError('an import never runs with remote control');
    assertRequestPath(launch.requestPath);
    // The prompt is positional: always last.
    args.push(`/import ${launch.requestPath}`);
    return args;
  }
  if (remoteControl) {
    // Last, so an omitted name cannot swallow the next argument as the name.
    args.push('--remote-control');
    if (remoteControl.name !== undefined) {
      if (!REMOTE_NAME.test(remoteControl.name)) throw new ClaudeArgsError('remote control name is not allowed');
      args.push(remoteControl.name);
    }
  }
  return args;
}
