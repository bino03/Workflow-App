/**
 * Manual check (step 4 of docs/features/novo-projeto-guiado.md): the production guided engine — the generated
 * guided-hook.cjs and --settings, GuidedService and TerminalsService — with the real `claude`. A temporary folder
 * stands in for the Workflow, with a throwaway `create` skill that asks two questions, writes a file (permission:
 * allowed), tries a Bash command (permission: refused), asks for free text, and writes result.json next to the
 * brief. This script answers through GuidedService, as the routes do. Sends a few prompts: spends a little quota.
 *
 *   npx tsx scripts/guided-engine-check.ts
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeGuidedFiles } from '../src/guided/guidedFiles.js';
import { GuidedService } from '../src/guided/guidedService.js';
import { ClaudeSessions } from '../src/sessions/claudeSessions.js';
import { StateStore } from '../src/state/stateStore.js';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TerminalsService } from '../src/terminals/terminalsService.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);

const root = mkdtempSync(join(tmpdir(), 'wfa-guided-engine-'));
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
    '2. Call AskUserQuestion ONCE with two questions: "Que forma tem a app?" (header "Forma", options "Back-office web interno (Recommended)" and "Site público") and "Que capacidades?" (header "Capacidades", multiSelect true, options "Ficheiros", "Notificações", "Idiomas").',
    '3. With the Write tool, create `answers.txt` in the current working directory with the two answers on one line.',
    '4. With the Bash tool, run `node -e "console.log(42)"`. If refused, do not retry.',
    '5. End your turn with exactly this question and nothing else: "Qual é o nome do projeto?"',
    '6. When the user answers, write `result.json` in the same folder as the brief with the Write tool, as JSON:',
    '   {"version":1,"status":"done","projectPath":null,"projectName":"<the name the user gave>","summary":"Teste: <the two answers>; bash <ran|refused>","openDecisions":[],"nextStep":null}',
    '   Then answer with one line: `ENGINE-DONE`.',
    '',
  ].join('\n'),
);

async function main() {
  log(`root: ${root}`);
  const terminalManager = new TerminalManager({ spawn: claudeSpawner(resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude')), maxTerminals: 1, scrollbackBytes: 4 << 20 });
  const claudeSessions = new ClaudeSessions(process.env.CLAUDE_CONFIG_DIR);
  const terminals = new TerminalsService({
    stateStore: await StateStore.load(dataDir),
    terminalManager,
    sessions: claudeSessions,
    allowedRoots: [root],
    guidedSettingsPath: writeGuidedFiles(dataDir, [root]),
    // A fresh temporary folder is not trusted yet: the dialog is answered below, through the PTY.
    isTrustedFolder: async () => true,
  });
  const guided = new GuidedService({ dataDir, terminals, sessions: claudeSessions });
  const started = Date.now();
  const rel = () => `+${Math.round((Date.now() - started) / 1000)}s`;
  const view = await guided.start({ purpose: 'create', cwd: workflow, input: 'Uma app de teste para o motor guiado.' });
  let screen = '';
  terminalManager.attach(view.terminalId, { onData: (d) => (screen += d), onExit: () => {} });

  let trusted = false;
  let replied = false;
  let last = '';
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    if (!trusted && /trust/i.test(screen)) {
      trusted = true;
      await sleep(500);
      terminalManager.write(view.terminalId, '\x1b[B');
      await sleep(300);
      terminalManager.write(view.terminalId, '\r');
    }
    const current = guided.get(view.id);
    if (current.status !== last) {
      log(`${rel()} status ${current.status}${current.pending ? ` ${JSON.stringify(current.pending).slice(0, 240)}` : ''}`);
      last = current.status;
    }
    if (current.pending?.type === 'question') {
      const answers = Object.fromEntries(
        current.pending.questions.map((q) => [q.question, q.multiSelect ? q.options.slice(0, 2).map((o) => o.label).join(', ') : q.options[0]!.label]),
      );
      log(`${rel()} → answer ${JSON.stringify(answers)}`);
      await guided.answer(view.id, { requestId: current.pending.requestId, answers });
    } else if (current.pending?.type === 'permission') {
      const decision = current.pending.tool === 'Bash' ? 'deny' : 'allow';
      log(`${rel()} → ${decision} ${current.pending.tool}: ${current.pending.summary}`);
      await guided.permission(view.id, { requestId: current.pending.requestId, decision });
    } else if (current.status === 'waiting-text' && !replied) {
      replied = true;
      log(`${rel()} → message (2 lines)`);
      await guided.message(view.id, 'O nome é\nGinasioMotor');
    } else if (current.status === 'done' || current.status === 'failed' || current.status === 'stopped') {
      log(`${rel()} result: ${JSON.stringify(current.result ?? current.error)}`);
      break;
    }
    await sleep(500);
  }
  log(`answers.txt: ${existsSync(join(workflow, 'answers.txt')) ? readFileSync(join(workflow, 'answers.txt'), 'utf8').trim() : '(absent)'}`);
  // Step 5: the conversation as the UI will show it.
  for (const entry of (await guided.feed(view.id, 0)).entries) {
    log(`  feed ${entry.type}: ${JSON.stringify({ ...entry, id: undefined, at: undefined, type: undefined }).slice(0, 200)}`);
  }
  await guided.remove(view.id);
  log(`removed; guided folder left: ${existsSync(join(dataDir, 'guided', view.id))}`);
  await terminalManager.killAll();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
