import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isUuid } from '../sessions/claudeSessions.js';
import { statusLineSetting } from '../usage/usageFiles.js';

/**
 * What an import's `claude` is launched with (ADR 0019): its own --settings — the quota status line plus three
 * hooks — and the hook script, both written into DATA_DIR at startup. The hooks are how the backend follows a
 * hidden terminal without reading its screen: each one only records which event happened last, per session.
 */
export const IMPORT_FILES = {
  settings: 'claude-import-settings.json',
  hook: 'import-hook.cjs',
  /** `<session_id>.json` = `{ event, at }`, the last hook event of that session. */
  events: 'import-events',
  /** `<import id>/request.json`, `files/…`, `result.json` — one folder per import. */
  imports: 'imports',
} as const;

export const IMPORT_HOOK_EVENTS = ['Stop', 'Notification', 'UserPromptSubmit'] as const;
export type ImportHookEvent = (typeof IMPORT_HOOK_EVENTS)[number];

/**
 * Runs inside Claude Code at every hook of an import session. It must never fail, never be slow and never print:
 * output from a Stop hook can hold the turn open. Only the event name and the time are kept — never the prompt,
 * the last message or paths. A session_id that is not a UUID is ignored, so it can never name a file.
 */
function hookScript(eventsDir: string): string {
  return `// Written by the Workflow App backend at startup (backend/src/imports/importFiles.ts). Do not edit.
const fs = require('node:fs');
const path = require('node:path');
const EVENTS_DIR = ${JSON.stringify(eventsDir)};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(${JSON.stringify(IMPORT_HOOK_EVENTS)});
let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (!UUID.test(data.session_id) || !EVENTS.has(data.hook_event_name)) return;
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
    const file = path.join(EVENTS_DIR, data.session_id.toLowerCase() + '.json');
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ event: data.hook_event_name, at: new Date().toISOString() }));
    fs.renameSync(tmp, file);
  } catch {}
});
`;
}

/** Writes the imports' settings and hook into DATA_DIR (every start). Returns the --settings path. */
export function writeImportFiles(dataDir: string): string {
  mkdirSync(dataDir, { recursive: true });
  const hook = join(dataDir, IMPORT_FILES.hook);
  const settings = join(dataDir, IMPORT_FILES.settings);
  writeFileSync(hook, hookScript(join(dataDir, IMPORT_FILES.events)));
  const command = { type: 'command', command: `"${process.execPath}" "${hook}"` };
  const hooks = Object.fromEntries(IMPORT_HOOK_EVENTS.map((event) => [event, [{ hooks: [command] }]]));
  writeFileSync(settings, `${JSON.stringify({ statusLine: statusLineSetting(dataDir), hooks }, null, 2)}\n`);
  return settings;
}

/** The last hook event of a session, or null (none yet, unreadable, or not a UUID). Never throws. */
export function readImportEvent(dataDir: string, sessionId: string): { event: ImportHookEvent; at: string } | null {
  if (!isUuid(sessionId)) return null;
  try {
    const data = JSON.parse(readFileSync(join(dataDir, IMPORT_FILES.events, `${sessionId.toLowerCase()}.json`), 'utf8')) as {
      event?: unknown;
      at?: unknown;
    };
    if (!IMPORT_HOOK_EVENTS.includes(data.event as ImportHookEvent) || typeof data.at !== 'string') return null;
    return { event: data.event as ImportHookEvent, at: data.at };
  } catch {
    return null;
  }
}
