import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Read-only access to the sessions Claude Code saves in `<config dir>/projects/<encoded cwd>/<uuid>.jsonl`.
 * The format is Claude Code's, not ours: every reader here is tolerant — a line it does not understand
 * is skipped, and nothing in this file throws because of a file's content.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** How Claude Code names a project folder: every non-alphanumeric character becomes `-` (confirmed in the spike). */
export function encodeProjectPath(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}

export const PREVIEW_MAX = 140;
export const SUMMARY_MAX = 600;

export type SessionInfo = {
  id: string;
  startedAt: string | null;
  /** The file's mtime: the last time Claude Code wrote to the session. */
  updatedAt: string;
  /** Prompts typed by the user plus assistant replies with text. */
  messageCount: number;
  /** The AI title, else the first prompt; null when the session has neither. */
  preview: string | null;
};

export type SessionSummary = {
  summary: string | null;
  summarySource: 'ai-title' | 'last-message' | null;
};

type Line = Record<string, unknown>;

function parseLines(text: string): Line[] {
  const lines: Line[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object' && !Array.isArray(value)) lines.push(value as Line);
    } catch {
      // A half-written last line (Claude Code still writing) or a format change: skip it.
    }
  }
  return lines;
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Text blocks of a message, or null when it is not plain conversation (tool results, images only…). */
function textOf(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const blocks = content as { type?: unknown; text?: unknown }[];
  if (blocks.some((block) => block?.type === 'tool_result')) return null;
  const text = blocks
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n');
  return text || null;
}

function isConversation(line: Line): boolean {
  return line.isSidechain !== true && line.isMeta !== true;
}

/** A prompt the user typed — not a tool result, not a CLI command echo (`<command-name>…`). */
function userPrompt(line: Line): string | null {
  if (line.type !== 'user' || !isConversation(line)) return null;
  const text = textOf((line.message as { content?: unknown } | undefined)?.content);
  if (!text || text.trimStart().startsWith('<')) return null;
  return oneLine(text) || null;
}

function assistantText(line: Line): string | null {
  if (line.type !== 'assistant' || !isConversation(line)) return null;
  const text = textOf((line.message as { content?: unknown } | undefined)?.content);
  return text ? oneLine(text) || null : null;
}

function lastAiTitle(lines: Line[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (line.type === 'ai-title' && typeof line.aiTitle === 'string' && line.aiTitle.trim()) return oneLine(line.aiTitle);
  }
  return null;
}

export class ClaudeSessions {
  readonly projectsDir: string;

  constructor(claudeConfigDir: string | undefined) {
    this.projectsDir = join(claudeConfigDir ?? join(homedir(), '.claude'), 'projects');
  }

  folderOf(cwd: string): string {
    return join(this.projectsDir, encodeProjectPath(cwd));
  }

  fileOf(cwd: string, sessionId: string): string {
    // The UUID check is what keeps a client-sent id from walking out of the folder.
    if (!isUuid(sessionId)) throw new Error('invalid session id');
    return join(this.folderOf(cwd), `${sessionId}.jsonl`);
  }

  hasSession(cwd: string, sessionId: string): boolean {
    return isUuid(sessionId) && existsSync(this.fileOf(cwd, sessionId));
  }

  /** Cheap: counts files without reading them (the folder browser shows it for every folder). */
  async countSessions(cwd: string): Promise<number> {
    return (await this.sessionFiles(cwd)).length;
  }

  /** Every saved session of a folder, most recently updated first. */
  async listSessions(cwd: string): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    for (const id of await this.sessionFiles(cwd)) {
      const info = await this.readInfo(cwd, id);
      if (info) sessions.push(info);
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** The most recently updated session of a folder ("Continuar a última"), or null. */
  async latestSessionId(cwd: string): Promise<string | null> {
    let latest: { id: string; mtime: number } | null = null;
    for (const id of await this.sessionFiles(cwd)) {
      try {
        const { mtimeMs } = await stat(this.fileOf(cwd, id));
        if (!latest || mtimeMs > latest.mtime) latest = { id, mtime: mtimeMs };
      } catch {
        // Deleted between readdir and stat.
      }
    }
    return latest?.id ?? null;
  }

  /** The summary kept in the history when a terminal closes. Never throws (closing must not fail on it). */
  async readSummary(cwd: string, sessionId: string): Promise<SessionSummary> {
    try {
      const lines = parseLines(await readFile(this.fileOf(cwd, sessionId), 'utf8'));
      const title = lastAiTitle(lines);
      if (title) return { summary: cut(title, SUMMARY_MAX), summarySource: 'ai-title' };
      for (let i = lines.length - 1; i >= 0; i--) {
        const text = assistantText(lines[i]!);
        if (text) return { summary: cut(text, SUMMARY_MAX), summarySource: 'last-message' };
      }
    } catch {
      // Missing file, invalid id, unreadable: the history keeps the terminal without a summary.
    }
    return { summary: null, summarySource: null };
  }

  private async sessionFiles(cwd: string): Promise<string[]> {
    try {
      return (await readdir(this.folderOf(cwd)))
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => name.slice(0, -'.jsonl'.length))
        .filter(isUuid);
    } catch {
      return [];
    }
  }

  private async readInfo(cwd: string, id: string): Promise<SessionInfo | null> {
    try {
      const file = this.fileOf(cwd, id);
      const [text, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
      const lines = parseLines(text);
      let startedAt: string | null = null;
      let firstPrompt: string | null = null;
      let messageCount = 0;
      for (const line of lines) {
        if (!startedAt && typeof line.timestamp === 'string') startedAt = line.timestamp;
        const prompt = userPrompt(line);
        if (prompt) {
          messageCount++;
          firstPrompt ??= prompt;
        } else if (assistantText(line)) {
          messageCount++;
        }
      }
      const preview = lastAiTitle(lines) ?? firstPrompt;
      return {
        id,
        startedAt,
        updatedAt: info.mtime.toISOString(),
        messageCount,
        preview: preview ? cut(preview, PREVIEW_MAX) : null,
      };
    } catch {
      return null;
    }
  }
}
