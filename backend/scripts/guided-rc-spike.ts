/**
 * Manual spike (ToDo "Continuar no Claude app", 2026-11-15): can a guided `/create` session, parked waiting for
 * free text, be handed over to the Claude app through Remote Control — and does the app then see the questions and
 * permission requests that the page normally answers through the blocking hook?
 *
 * The engine is the production one (writeGuidedFiles, GuidedService, TerminalsService) on a throwaway Workflow
 * folder with a stand-in `create` skill, like guided-engine-check.ts. The settings drop the two blocking hooks
 * (PreToolUse AskUserQuestion, PermissionRequest) — what the hook would do once `remote: true` is on — so every
 * question and permission is asked natively by the TUI.
 *
 *   npx tsx scripts/guided-rc-spike.ts --via paste   [--minutes 15]   /remote-control <name> as a bracketed paste
 *   npx tsx scripts/guided-rc-spike.ts --via typed   [--minutes 15]   the same, typed key by key (no paste markers)
 *   npx tsx scripts/guided-rc-spike.ts --via resume  [--minutes 15]   stop, then --resume … --remote-control <name>
 *
 * The owner watches the Claude app → Code for the name and answers there. Spends a little quota.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import xtermHeadless from '@xterm/headless';
import { writeGuidedFiles } from '../src/guided/guidedFiles.js';
import { GuidedService } from '../src/guided/guidedService.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { StateStore } from '../src/state/stateStore.js';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';

const { Terminal } = xtermHeadless;
const envFile = join(import.meta.dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1]! : fallback);
const via = opt('--via', 'paste') as 'paste' | 'typed' | 'resume';
const minutes = Number(opt('--minutes', '15'));
const NAME = 'Novo projeto · create';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const log = (line: string) => console.log(`+${Math.round((Date.now() - started) / 1000)}s ${line}`);

const root = mkdtempSync(join(tmpdir(), 'wfa-guided-rc-'));
const workflow = join(root, 'Workflow');
const dataDir = join(root, 'data');
mkdirSync(join(workflow, '.claude', 'skills', 'create'), { recursive: true });
writeFileSync(
  join(workflow, '.claude', 'skills', 'create', 'SKILL.md'),
  [
    '---',
    'name: create',
    'description: Test stand-in for the Workflow /create in app mode. The argument is `--app <brief path>`.',
    '---',
    '',
    'The argument is `--app <path>`. Do exactly these steps, in order:',
    '',
    '1. Read the brief at that path with the Read tool.',
    '2. End your turn with exactly this question and nothing else: "Qual é o nome do projeto?"',
    '3. When the user answers, call AskUserQuestion ONCE with one question: "Que forma tem a app?" (header "Forma", options "Back-office web interno (Recommended)" and "Site público").',
    '4. With the Write tool, create `answers.txt` in the current working directory with the name and the answer on one line.',
    '5. Write `result.json` in the same folder as the brief with the Write tool, as JSON:',
    '   {"version":1,"status":"done","projectPath":null,"projectName":"<the name>","summary":"Spike RC: <the answer>","openDecisions":[],"nextStep":null}',
    '   Then answer with one line: `RC-SPIKE-DONE`.',
    '',
  ].join('\n'),
);

/** The guided settings as `remote: true` would leave them: no blocking hook, everything else unchanged. */
function remoteSettings(path: string): void {
  const content = JSON.parse(readFileSync(path, 'utf8'));
  content.hooks.PreToolUse = content.hooks.PreToolUse.filter((h: { matcher?: string }) => h.matcher !== 'AskUserQuestion');
  delete content.hooks.PermissionRequest;
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
}

async function main() {
  log(`root: ${root} · via ${via}`);
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const terminalManager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 2, scrollbackBytes: 4 << 20 });
  const claudeSessions = new ClaudeSessions(process.env.CLAUDE_CONFIG_DIR);
  const settingsPath = writeGuidedFiles(dataDir, [root]);
  remoteSettings(settingsPath);
  const terminals = new TerminalsService({
    stateStore: await StateStore.load(dataDir),
    terminalManager,
    sessions: claudeSessions,
    allowedRoots: [root],
    guidedSettingsPath: settingsPath,
    isTrustedFolder: async () => true,
  });
  const guided = new GuidedService({ dataDir, terminals, sessions: claudeSessions });
  const view = await guided.start({ purpose: 'create', cwd: workflow, input: 'Uma app de teste para o spike do Remote Control.' });

  // A headless xterm reads the screen the owner would see in "Ver terminal".
  const term = new Terminal({ cols: 120, rows: 36, allowProposedApi: true });
  const watch = (terminalId: string) => terminalManager.attach(terminalId, { onData: (d) => term.write(d), onExit: (c) => log(`pty exit ${c}`) });
  watch(view.terminalId);
  const screen = () => {
    const b = term.buffer.active;
    const lines: string[] = [];
    for (let i = Math.max(0, b.length - 36); i < b.length; i++) lines.push(b.getLine(i)?.translateToString(true) ?? '');
    return lines.filter((l) => l.trim()).join('\n');
  };
  let shot = 0;
  const save = (label: string) => {
    const file = join(root, `screen-${String(++shot).padStart(2, '0')}-${label}.txt`);
    writeFileSync(file, screen());
    log(`screen → ${file}`);
    const hits = screen().split('\n').filter((l) => /remote|claude\.ai|\/rc|toggle|error|unknown|trust/i.test(l));
    if (hits.length) log(`  lines: ${JSON.stringify(hits.map((l) => l.trim()).slice(0, 6))}`);
  };

  // Two dialogs since CLI 2.1.327: the cwd's trust, then one per untrusted --add-dir folder. Answer each one on screen.
  let lastTrustAnswer = 0;
  let handedOver = false;
  let last = '';
  let resumedId: string | null = null;
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    if (/trust/i.test(screen()) && /No, exit/.test(screen()) && Date.now() - lastTrustAnswer > 3000) {
      lastTrustAnswer = Date.now();
      await sleep(500);
      terminalManager.write(view.terminalId, '\x1b[B');
      await sleep(300);
      terminalManager.write(view.terminalId, '\r');
      log('trust dialog answered');
    }
    const current = guided.get(view.id);
    if (current.status !== last) {
      log(`status ${current.status}`);
      last = current.status;
      if (handedOver) save(current.status);
    }
    if (current.status === 'waiting-text' && !handedOver) {
      handedOver = true;
      save('before');
      if (via === 'paste') {
        log(`→ paste "/remote-control ${NAME}"`);
        await guided.message(view.id, `/remote-control ${NAME}`);
      } else if (via === 'typed') {
        log(`→ typed "/remote-control ${NAME}"`);
        for (const ch of `/remote-control ${NAME}`) {
          terminalManager.write(view.terminalId, ch);
          await sleep(25);
        }
        await sleep(400);
        terminalManager.write(view.terminalId, '\r');
      } else {
        const sessionId: string = JSON.parse(readFileSync(join(dataDir, "guided", view.id, "meta.json"), "utf8")).claudeSessionId;
        log(`→ stop, then --resume ${sessionId} --remote-control "${NAME}"`);
        await terminalManager.kill(view.terminalId);
        await sleep(1500);
        const info = terminalManager.create({
          cwd: workflow,
          cols: 120,
          rows: 36,
          args: ['--resume', sessionId, '--settings', settingsPath, '--add-dir', dataDir, '--permission-mode', 'default', '--remote-control', NAME],
        });
        resumedId = info.id;
        term.reset();
        watch(info.id);
      }
      await sleep(12_000);
      save('after-handover');
      log(`HOLDING up to ${minutes} min — look for "${NAME}" in the Claude app → Code and answer the questions there`);
    }
    if (current.status === 'done' || current.status === 'failed') {
      log(`result: ${JSON.stringify(current.result ?? current.error)}`);
      break;
    }
    if (handedOver && Date.now() % 60_000 < 600) save('tick');
    await sleep(500);
  }
  save('end');
  log(`answers.txt: ${existsSync(join(workflow, 'answers.txt')) ? readFileSync(join(workflow, 'answers.txt'), 'utf8').trim() : '(absent)'}`);
  for (const entry of (await guided.feed(view.id, 0)).entries) {
    log(`  feed ${entry.type}: ${JSON.stringify({ ...entry, id: undefined, at: undefined, type: undefined }).slice(0, 220)}`);
  }
  if (resumedId) await terminalManager.kill(resumedId);
  await terminalManager.killAll();
  if (args.includes('--clean')) rmSync(root, { recursive: true, force: true });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
