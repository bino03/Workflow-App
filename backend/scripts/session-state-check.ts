/**
 * Manual check (ToDo → Terminais, "Estado de cada sessão", ADR 0031): the production chain — session-hook.cjs and
 * the common claude-settings.json, the WFA_TERMINAL_ID the spawner sets, SessionStateStore and TerminalsService —
 * with the real `claude`, in a normal terminal. Follows `activity` through: waiting → working → needs-you (a Bash
 * permission) → working → waiting → needs-you (AskUserQuestion) → working → waiting → ended (status exited,
 * activity null). The project's .claude/settings.local.json forces the "default" permission mode, whatever the
 * account's is. Sends two prompts: spends a little quota.
 *
 *   npx tsx scripts/session-state-check.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { StateStore } from '../src/state/stateStore.js';
import { SessionStateStore, sessionStateHooks, writeSessionHook } from '../src/terminals/sessionState.js';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';
import { writeUsageFiles } from '../src/usage/usageFiles.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);

const root = mkdtempSync(join(tmpdir(), 'wfa-state-check-'));
const project = join(root, 'projeto');
const dataDir = join(root, 'data');
mkdirSync(join(project, '.claude'), { recursive: true });
writeFileSync(join(project, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { defaultMode: 'default' } }));

async function main() {
  log(`check root: ${root}`);
  writeSessionHook(dataDir);
  const settingsPath = writeUsageFiles(dataDir, sessionStateHooks(dataDir));
  const stateStore = await StateStore.load(dataDir);
  const manager = new TerminalManager({ spawn: claudeSpawner(resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude')), maxTerminals: 2, scrollbackBytes: 1 << 20 });
  const service = new TerminalsService({
    stateStore,
    terminalManager: manager,
    sessions: new ClaudeSessions(process.env.CLAUDE_CONFIG_DIR ?? join(process.env.USERPROFILE ?? '', '.claude')),
    allowedRoots: [root],
    settingsPath,
    sessionState: new SessionStateStore(dataDir),
  });

  const view = await service.create({ cwd: project, mode: 'new', cols: 140, rows: 40 });
  let screen = '';
  manager.attach(view.id, { onData: (d) => (screen += d), onExit: () => {} });
  const started = Date.now();

  // Every change of (status, activity), as GET /api/terminals would show it.
  const timeline: string[] = [];
  let last = '';
  const poll = setInterval(() => {
    const now = service.get(view.id);
    const key = `${now?.status}/${now?.activity}`;
    if (key !== last) {
      last = key;
      timeline.push(now?.activity ?? `ended(${now?.status})`);
      log(`  +${String(Date.now() - started).padStart(6)} ms  status=${now?.status} activity=${now?.activity}`);
    }
  }, 150);
  const current = () => service.get(view.id)?.activity;
  const waitActivity = async (wanted: string, ms: number) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (current() === wanted) return true;
      await sleep(200);
    }
    log(`  (timeout waiting for ${wanted})`);
    return false;
  };
  const type = async (text: string) => {
    manager.write(view.id, `\x1b[200~${text}\x1b[201~`);
    await sleep(400);
    manager.write(view.id, '\r');
  };

  // Trust dialog of a never-seen folder: Down, Enter (the default is "No, exit").
  const trustBy = Date.now() + 20_000;
  while (Date.now() < trustBy && !/trust/i.test(screen)) await sleep(200);
  if (/trust/i.test(screen)) {
    await sleep(500);
    manager.write(view.id, '\x1b[B');
    await sleep(300);
    manager.write(view.id, '\r');
  }
  await sleep(4000);

  log('--- a Bash command that asks for permission');
  await type('Run exactly this shell command with the Bash tool: node -e "console.log(42)" — then answer only with its output.');
  if (await waitActivity('needs-you', 90_000)) {
    await sleep(1500);
    manager.write(view.id, '\r'); // "Yes"
  }
  await waitActivity('waiting', 120_000);

  log('--- AskUserQuestion');
  await sleep(1000);
  await type('Use the AskUserQuestion tool once: question "Que cor?", header "Cor", options "Azul" and "Verde". Then answer only with the chosen option.');
  if (await waitActivity('needs-you', 90_000)) {
    await sleep(1500);
    manager.write(view.id, '\r'); // first option
    await sleep(800);
    manager.write(view.id, '\r'); // submit, if the TUI asks for it
  }
  await waitActivity('waiting', 120_000);

  log('--- exit');
  manager.write(view.id, '\x03');
  await sleep(400);
  manager.write(view.id, '\x03');
  const exitBy = Date.now() + 10_000;
  while (Date.now() < exitBy && service.get(view.id)?.status === 'running') await sleep(200);
  await sleep(400);
  clearInterval(poll);

  const expected = ['waiting', 'working', 'needs-you', 'working', 'waiting', 'working', 'needs-you', 'working', 'waiting', 'ended(exited)'];
  const ok = JSON.stringify(timeline) === JSON.stringify(expected);
  log(`\ntimeline: ${timeline.join(' → ')}`);
  log(`${ok ? 'PASS' : 'FAIL'} — expected ${expected.join(' → ')}`);
  writeFileSync(join(root, 'screen.txt'), screen);
  await manager.killAll();
  await stateStore.flush();
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
