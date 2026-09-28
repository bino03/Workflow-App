import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The quota comes from the JSON Claude Code hands to its status line command (ADR 0012, confirmed in the
 * spike of step 1): every `claude` the app launches gets `--settings DATA_DIR/claude-settings.json`, whose
 * status line runs `statusline.cjs`, which keeps the latest `rate_limits` in `usage.json`.
 */
export const USAGE_FILES = {
  settings: 'claude-settings.json',
  script: 'statusline.cjs',
  usage: 'usage.json',
} as const;

/**
 * Runs inside Claude Code, once per status line refresh, for every terminal. It must never fail or be slow:
 * everything is in a try/catch and it always prints a line. Only `rate_limits` (plus when it was seen) is
 * kept — never paths, prompts or session ids. The first JSON of a fresh session has no `rate_limits`, so
 * nothing is written then (otherwise every new terminal would wipe the value).
 */
function statusLineScript(usageFile: string): string {
  return `// Written by the Workflow App backend at startup (backend/src/usage/usageFiles.ts). Do not edit.
const fs = require('node:fs');
const path = require('node:path');
const USAGE_FILE = ${JSON.stringify(usageFile)};
let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let line = '';
  try {
    const data = JSON.parse(input);
    line = [data.model && data.model.display_name, data.cwd && path.basename(data.cwd)].filter(Boolean).join(' · ');
    const limits = data.rate_limits;
    if (limits && (limits.five_hour || limits.seven_day)) {
      const body = JSON.stringify({ rate_limits: { five_hour: limits.five_hour, seven_day: limits.seven_day }, fetchedAt: new Date().toISOString() });
      const tmp = USAGE_FILE + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, body);
      for (let attempt = 0; ; attempt++) {
        try {
          fs.renameSync(tmp, USAGE_FILE);
          break;
        } catch (error) {
          if (attempt >= 4) { try { fs.unlinkSync(tmp); } catch {} break; }
          const until = Date.now() + 20 * (attempt + 1);
          while (Date.now() < until) {}
        }
      }
    }
  } catch {}
  process.stdout.write(line);
});
`;
}

/** Writes the settings and the script into DATA_DIR (every start: they are ours). Returns the --settings path. */
export function writeUsageFiles(dataDir: string): string {
  mkdirSync(dataDir, { recursive: true });
  const usageFile = join(dataDir, USAGE_FILES.usage);
  const script = join(dataDir, USAGE_FILES.script);
  const settings = join(dataDir, USAGE_FILES.settings);
  writeFileSync(script, statusLineScript(usageFile));
  writeFileSync(
    settings,
    `${JSON.stringify({ statusLine: { type: 'command', command: `"${process.execPath}" "${script}"` } }, null, 2)}\n`,
  );
  return settings;
}

export type UsageWindow = { usedPct: number; resetsAt: string };
export type UsageView = { fiveHour: UsageWindow | null; weekly: UsageWindow | null; fetchedAt: string | null };

function toWindow(raw: unknown): UsageWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const { used_percentage: used, resets_at: resets } = raw as { used_percentage?: unknown; resets_at?: unknown };
  if (typeof used !== 'number' || !Number.isFinite(used) || typeof resets !== 'number' || !Number.isFinite(resets)) return null;
  // resets_at comes in Unix seconds.
  return { usedPct: Math.min(100, Math.max(0, used)), resetsAt: new Date(resets * 1000).toISOString() };
}

/** The last quota seen by any terminal. Missing or unreadable file → nulls, never an error. */
export function readUsage(dataDir: string): UsageView {
  try {
    const data = JSON.parse(readFileSync(join(dataDir, USAGE_FILES.usage), 'utf8')) as {
      rate_limits?: { five_hour?: unknown; seven_day?: unknown };
      fetchedAt?: unknown;
    };
    const fetchedAt = typeof data.fetchedAt === 'string' && !Number.isNaN(Date.parse(data.fetchedAt)) ? data.fetchedAt : null;
    return { fiveHour: toWindow(data.rate_limits?.five_hour), weekly: toWindow(data.rate_limits?.seven_day), fetchedAt };
  } catch {
    return { fiveHour: null, weekly: null, fetchedAt: null };
  }
}
