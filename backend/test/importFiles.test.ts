import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IMPORT_FILES, readImportEvent, writeImportFiles } from '../src/imports/importFiles.js';
import { USAGE_FILES, writeUsageFiles } from '../src/usage/usageFiles.js';

const SESSION = '880e0a0e-9dc4-4985-956d-f3a6ec3b0983';
// The keys seen in the import spike (claude 2.1.310), trimmed.
const stop = {
  session_id: SESSION,
  transcript_path: 'C:\\Users\\me\\.claude\\projects\\x\\880e0a0e.jsonl',
  cwd: 'C:\\Users\\me\\Workflow',
  hook_event_name: 'Stop',
  stop_hook_active: false,
  last_assistant_message: 'SPIKE-RESULT secret text that must not be kept',
};

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'wfa-import-files-'));
});
afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

type Settings = { statusLine: { command: string }; hooks: Record<string, { hooks: { type: string; command: string }[] }[]> };

/** Runs the hook the way Claude Code does: the event as JSON on stdin. */
function runHook(input: string) {
  const settings = JSON.parse(readFileSync(join(dataDir, IMPORT_FILES.settings), 'utf8')) as Settings;
  const [node, script] = [...settings.hooks.Stop![0]!.hooks[0]!.command.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const result = spawnSync(node!, [script!], { input, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('import files (ADR 0019)', () => {
  it('settings keep the quota status line and point the three hooks at this node and the script', () => {
    writeUsageFiles(dataDir);
    const path = writeImportFiles(dataDir);
    expect(path).toBe(join(dataDir, IMPORT_FILES.settings));
    const settings = JSON.parse(readFileSync(path, 'utf8')) as Settings;
    expect(settings.statusLine.command).toBe(`"${process.execPath}" "${join(dataDir, USAGE_FILES.script)}"`);
    expect(Object.keys(settings.hooks).sort()).toEqual(['Notification', 'Stop', 'UserPromptSubmit']);
    for (const entries of Object.values(settings.hooks)) {
      expect(entries).toEqual([{ hooks: [{ type: 'command', command: `"${process.execPath}" "${join(dataDir, IMPORT_FILES.hook)}"` }] }]);
    }
  });

  it('the hook keeps only the event and the time, prints nothing and exits 0', () => {
    writeImportFiles(dataDir);
    const run = runHook(JSON.stringify(stop));
    expect(run).toMatchObject({ status: 0, stdout: '', stderr: '' });
    const saved = readFileSync(join(dataDir, IMPORT_FILES.events, `${SESSION}.json`), 'utf8');
    expect(saved).not.toContain('secret');
    expect(readImportEvent(dataDir, SESSION)).toEqual({ event: 'Stop', at: expect.any(String) });

    runHook(JSON.stringify({ ...stop, hook_event_name: 'UserPromptSubmit', prompt: '/import x' }));
    expect(readImportEvent(dataDir, SESSION)?.event).toBe('UserPromptSubmit');
  });

  it('ignores a session_id that is not a UUID, an unknown event and garbage — still exit 0, nothing written', () => {
    writeImportFiles(dataDir);
    for (const input of [
      JSON.stringify({ ...stop, session_id: '..\\..\\state' }),
      JSON.stringify({ ...stop, hook_event_name: 'PreToolUse' }),
      'not json',
      '',
    ]) {
      expect(runHook(input)).toMatchObject({ status: 0, stdout: '' });
    }
    expect(existsSync(join(dataDir, IMPORT_FILES.events)) ? readdirSync(join(dataDir, IMPORT_FILES.events)) : []).toEqual([]);
  });

  it('readImportEvent: null without a file, for a non-UUID and for a file it does not recognise', () => {
    expect(readImportEvent(dataDir, SESSION)).toBeNull();
    expect(readImportEvent(dataDir, '../state')).toBeNull();
    writeImportFiles(dataDir);
    runHook(JSON.stringify(stop));
    writeFileSync(join(dataDir, IMPORT_FILES.events, `${SESSION}.json`), '{"event":"Other","at":"x"}');
    expect(readImportEvent(dataDir, SESSION)).toBeNull();
  });
});
