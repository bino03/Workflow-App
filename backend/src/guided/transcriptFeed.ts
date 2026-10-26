import { stat, readFile } from 'node:fs/promises';
import { type Question, questionSchema } from './guided.schemas.js';

/**
 * The conversation a guided session shows, read from Claude Code's own `.jsonl` (ADR 0020 point 8) and reduced to
 * a few kinds of entry. The format is not a public contract: everything that depends on it lives here, tested
 * against a real transcript (`test/fixtures/guided-transcript.jsonl`). A line that does not make sense is skipped —
 * it never fails the request.
 *
 * Not shown: system lines, skill bodies (`isMeta`), tool results, thinking, sub-agents (`isSidechain`), and the
 * slash command that started the session (the service shows the brief in its place).
 */
export type FeedEntry =
  | { id: string; type: 'assistant-text'; markdown: string; at: string }
  | { id: string; type: 'user-text'; text: string; at: string }
  | { id: string; type: 'question'; questions: Question[]; answers: Record<string, string> | null; at: string }
  | { id: string; type: 'permission'; summary: string; decision: 'allow' | 'deny' | null; at: string }
  | { id: string; type: 'activity'; summary: string; count: number; at: string };

type Line = Record<string, unknown>;
type Block = Record<string, unknown>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** What a tool call is about, in one line: the command, or the path — never a file's content. */
export function toolTarget(tool: string, input: unknown): string {
  const i = isObject(input) ? input : {};
  const pick = tool === 'Bash' ? i.command : (i.file_path ?? i.notebook_path ?? i.url ?? i.pattern ?? i.path ?? i.skill ?? i.description);
  return String(typeof pick === 'string' ? pick : JSON.stringify(i)).slice(0, 300);
}

/** How a run of tool calls reads in Portuguese: one count per kind, in the order they first appeared. */
const ACTIVITY_KINDS: { tools: string[]; one: string; many: string }[] = [
  { tools: ['Read'], one: 'Leu 1 ficheiro', many: 'Leu # ficheiros' },
  { tools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'], one: 'Escreveu 1 ficheiro', many: 'Escreveu # ficheiros' },
  { tools: ['Bash', 'PowerShell'], one: 'Correu 1 comando', many: 'Correu # comandos' },
  { tools: ['Glob', 'Grep'], one: 'Fez 1 pesquisa', many: 'Fez # pesquisas' },
  { tools: ['WebFetch', 'WebSearch'], one: 'Consultou 1 página', many: 'Consultou # páginas' },
  { tools: ['Skill'], one: 'Abriu 1 skill', many: 'Abriu # skills' },
  { tools: ['Task', 'Agent'], one: 'Lançou 1 agente', many: 'Lançou # agentes' },
];

function activitySummary(calls: { tool: string; target: string }[]): string {
  const parts = new Map<string, Set<string> | number>();
  for (const { tool, target } of calls) {
    const kind = ACTIVITY_KINDS.find((k) => k.tools.includes(tool));
    const key = kind ? kind.one : `Usou ${tool}`;
    // Files count once each (an Edit twice on the same file is one file); the rest count each call.
    if (kind && (kind.tools.includes('Read') || kind.tools.includes('Write'))) {
      const seen = (parts.get(key) as Set<string> | undefined) ?? new Set<string>();
      parts.set(key, seen.add(target));
    } else parts.set(key, ((parts.get(key) as number | undefined) ?? 0) + 1);
  }
  return [...parts.entries()]
    .map(([key, value]) => {
      const n = typeof value === 'number' ? value : value.size;
      const kind = ACTIVITY_KINDS.find((k) => k.one === key);
      return kind ? (n === 1 ? kind.one : kind.many.replace('#', String(n))) : n === 1 ? key : `${key} (${n}×)`;
    })
    .join(' · ');
}

/** A user line is the owner's own text: not a tool result, not a skill body, not the slash command or a system tag. */
function userText(line: Line): string | null {
  if (line.isMeta === true || line.toolUseResult !== undefined) return null;
  const content = isObject(line.message) ? line.message.content : undefined;
  let value: string;
  if (typeof content === 'string') value = content;
  else if (Array.isArray(content) && content.every((b) => isObject(b) && b.type === 'text')) value = content.map((b) => text((b as Block).text)).join('\n');
  else return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('<') || trimmed.startsWith('[Request interrupted')) return null;
  return trimmed;
}

/** Builds the feed from the transcript's lines, in order. Pure. */
export function buildFeed(rawLines: string[]): FeedEntry[] {
  const lines: Line[] = [];
  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isObject(parsed) && parsed.isSidechain !== true) lines.push(parsed);
    } catch {
      // A line being written as we read, or one we do not understand.
    }
  }

  // First pass: what later lines say about a tool call — the answers to a question, a permission's decision.
  const answers = new Map<string, Record<string, string>>();
  const decisions = new Map<string, 'allow' | 'deny'>();
  for (const line of lines) {
    const result = line.toolUseResult;
    const content = isObject(line.message) && Array.isArray(line.message.content) ? line.message.content : [];
    const toolUseId = content.map((b) => (isObject(b) ? text(b.tool_use_id) : '')).find(Boolean);
    if (toolUseId && isObject(result) && isObject(result.answers)) {
      answers.set(toolUseId, Object.fromEntries(Object.entries(result.answers).filter(([, v]) => typeof v === 'string')) as Record<string, string>);
    }
    const attachment = line.attachment;
    if (line.type === 'attachment' && isObject(attachment) && attachment.type === 'hook_permission_decision') {
      const decision = attachment.decision;
      if ((decision === 'allow' || decision === 'deny') && typeof attachment.toolUseID === 'string') decisions.set(attachment.toolUseID, decision);
    }
  }

  const entries: FeedEntry[] = [];
  let activity: { id: string; at: string; calls: { tool: string; target: string }[] } | null = null;
  let lastTextMessageId: string | null = null;
  const flushActivity = () => {
    if (activity) entries.push({ id: activity.id, type: 'activity', summary: activitySummary(activity.calls), count: activity.calls.length, at: activity.at });
    activity = null;
  };

  for (const line of lines) {
    const at = text(line.timestamp);
    if (line.type === 'user') {
      const value = userText(line);
      if (value === null) continue;
      flushActivity();
      lastTextMessageId = null;
      entries.push({ id: text(line.uuid) || `user-${entries.length}`, type: 'user-text', text: value, at });
      continue;
    }
    if (line.type !== 'assistant' || !isObject(line.message) || !Array.isArray(line.message.content)) continue;
    const messageId = text(line.message.id);
    for (const [index, block] of line.message.content.entries()) {
      if (!isObject(block)) continue;
      if (block.type === 'text' && text(block.text).trim()) {
        flushActivity();
        const previous = entries.at(-1);
        // Claude Code writes one line per content block; blocks of the same message are one bubble.
        if (previous?.type === 'assistant-text' && messageId && messageId === lastTextMessageId) {
          previous.markdown = `${previous.markdown}\n\n${text(block.text).trim()}`;
        } else {
          entries.push({ id: `${text(line.uuid) || messageId}-${index}`, type: 'assistant-text', markdown: text(block.text).trim(), at });
        }
        lastTextMessageId = messageId;
        continue;
      }
      if (block.type !== 'tool_use') continue;
      lastTextMessageId = null;
      const id = text(block.id) || `${text(line.uuid)}-${index}`;
      const tool = text(block.name);
      if (tool === 'AskUserQuestion') {
        const questions = isObject(block.input) && Array.isArray(block.input.questions) ? block.input.questions.map((q) => questionSchema.safeParse(q)) : [];
        if (questions.length === 0 || questions.some((q) => !q.success)) continue;
        flushActivity();
        entries.push({ id, type: 'question', questions: questions.map((q) => q.data!), answers: answers.get(id) ?? null, at });
        continue;
      }
      const decision = decisions.get(id);
      if (decision) {
        flushActivity();
        entries.push({ id, type: 'permission', summary: `${tool}: ${toolTarget(tool, block.input)}`, decision, at });
        continue;
      }
      activity ??= { id, at, calls: [] };
      activity.calls.push({ tool, target: toolTarget(tool, block.input) });
    }
  }
  flushActivity();
  return entries;
}

/**
 * Reads a transcript's feed, re-reading the file only when its size or mtime changed (the UI polls every 1.5 s,
 * and a /create transcript grows to megabytes). A missing file is an empty feed: claude writes it with the
 * first message.
 */
export class TranscriptFeed {
  private readonly cache = new Map<string, { size: number; mtimeMs: number; entries: FeedEntry[] }>();

  async read(file: string): Promise<FeedEntry[]> {
    let info;
    try {
      info = await stat(file);
    } catch {
      return [];
    }
    const cached = this.cache.get(file);
    if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) return cached.entries;
    const entries = buildFeed((await readFile(file, 'utf8')).split('\n'));
    this.cache.delete(file);
    this.cache.set(file, { size: info.size, mtimeMs: info.mtimeMs, entries });
    // A handful of sessions at most; keep the newest.
    if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value!);
    return entries;
  }
}

/**
 * `after` = how many entries the client has. The last of them is sent again — only the last one can still
 * change (an activity that grows, a question that gets its answer) — and the client replaces it by id.
 */
export function feedPage(entries: FeedEntry[], after: number): { entries: FeedEntry[]; cursor: string } {
  return { entries: entries.slice(Math.max(0, Math.min(after, entries.length) - 1)), cursor: String(entries.length) };
}
