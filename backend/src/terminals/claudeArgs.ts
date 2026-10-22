import { isAbsolute } from 'node:path';
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
  | { kind: 'resume'; sessionId: string };

export type ClaudeArgsOptions = {
  /** DATA_DIR/claude-settings.json, written by the backend (quota status line). Omitted → no --settings. */
  settingsPath?: string;
  /** Remote Control (ADR 0017). `name` omitted → Claude Code's automatic name. */
  remoteControl?: { name?: string };
};

/**
 * A Remote Control session name: built by the backend (project · conversation title), never typed by a client.
 * Starts with a letter or digit, so it can never read as a flag; no quotes, `$`, newlines or other controls.
 */
export const REMOTE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._\-()·]{0,79}$/u;

export class ClaudeArgsError extends Error {
  override name = 'ClaudeArgsError';
}

export function claudeArgs(launch: ClaudeLaunch, { settingsPath, remoteControl }: ClaudeArgsOptions = {}): string[] {
  if (!isUuid(launch.sessionId)) throw new ClaudeArgsError('session id must be a UUID');
  const args = launch.kind === 'new' ? ['--session-id', launch.sessionId] : ['--resume', launch.sessionId];
  if (settingsPath !== undefined) {
    if (!isAbsolute(settingsPath)) throw new ClaudeArgsError('settings path must be absolute');
    args.push('--settings', settingsPath);
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
