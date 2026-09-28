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
};

export class ClaudeArgsError extends Error {
  override name = 'ClaudeArgsError';
}

export function claudeArgs(launch: ClaudeLaunch, { settingsPath }: ClaudeArgsOptions = {}): string[] {
  if (!isUuid(launch.sessionId)) throw new ClaudeArgsError('session id must be a UUID');
  const args = launch.kind === 'new' ? ['--session-id', launch.sessionId] : ['--resume', launch.sessionId];
  if (settingsPath !== undefined) {
    if (!isAbsolute(settingsPath)) throw new ClaudeArgsError('settings path must be absolute');
    args.push('--settings', settingsPath);
  }
  return args;
}
