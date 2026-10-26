/**
 * Manual dry run (step 3 of docs/features/novo-projeto-guiado.md): the real `/create --app <brief.md>` of the
 * Workflow, launched the way the app will launch it (PTY, cwd = Workflow, --add-dir, --settings with blocking
 * hooks, --permission-mode default), answered by this script instead of a person:
 *
 *   - every AskUserQuestion → the "(Recommended)" option (or the first); the destination → a temp folder that
 *     must never be created; the Phase 2 confirmation → "Cancelar";
 *   - a turn that ends without a question → "Não sei — deixa em aberto e segue." (at most 3 times);
 *   - permissions → allowed only for read-only git and for writes inside the brief's folder; everything else
 *     is denied and logged. A permission asked for a write in the brief's folder means the settings' allow rule
 *     did not match.
 *
 * Ends when result.json appears (expected: status "failed", "Cancelado pelo utilizador"). Spends quota.
 *
 *   npx tsx scripts/create-app-dry-run.ts --workflow <path>
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { claudeSpawner, resolveClaudeBin } from '../src/terminals/spawnClaude.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.log(line);
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const workflow = resolve(flag('workflow') ?? process.env.WORKFLOW_PATH ?? '');
if (!existsSync(join(workflow, 'docs', 'skills', 'skill-create.md'))) throw new Error(`not a Workflow: ${workflow}`);

const root = mkdtempSync(join(tmpdir(), 'wfa-create-dry-run-'));
const guidedDir = join(root, 'guided', randomUUID());
const briefPath = join(guidedDir, 'brief.md');
const resultPath = join(guidedDir, 'result.json');
const pendingPath = join(guidedDir, 'pending.json');
const answerPath = join(guidedDir, 'answer.json');
const events = join(root, 'events.jsonl');
const hook = join(root, 'guided-hook.cjs');
const settings = join(root, 'claude-settings.json');
const destination = join(root, 'never-created', 'GinasioTeste');
mkdirSync(guidedDir, { recursive: true });

writeFileSync(
  briefPath,
  [
    'GinasioTeste — uma app para gerir as reservas das aulas do meu ginásio.',
    '',
    'Hoje as reservas fazem-se por WhatsApp e num caderno, e há aulas cheias que ninguém sabe que estão cheias.',
    'Usamo-la eu (o dono) e os dois funcionários, ao balcão, num portátil. Eu vejo tudo e mexo nos preços; os',
    'funcionários marcam e desmarcam reservas mas não veem a faturação.',
    'A versão mínima: aulas com horário e lotação, sócios, e reservas de um sócio numa aula. Pagamentos online e',
    'app para os sócios ficam para depois.',
    'Coisas: aula (nome, dia e hora, lotação), sócio (nome, telefone, estado da quota), reserva (um sócio numa aula).',
    'Uma aula tem muitas reservas; um sócio tem muitas reservas.',
    'Se só pudesse ter dois ecrãs: o horário da semana com a ocupação de cada aula, e a ficha do sócio.',
    'É só para o meu ginásio, não é um produto. Sem integrações externas.',
    '',
  ].join('\n'),
);

writeFileSync(
  hook,
  `const fs = require('node:fs');
const EVENTS = ${JSON.stringify(events)};
const PENDING = ${JSON.stringify(pendingPath)};
const ANSWER = ${JSON.stringify(answerPath)};
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  let data;
  try { data = JSON.parse(input); } catch { return; }
  fs.appendFileSync(EVENTS, JSON.stringify({ at: Date.now(), event: data.hook_event_name, data }) + '\\n');
  const blocking = (data.hook_event_name === 'PreToolUse' && data.tool_name === 'AskUserQuestion') || data.hook_event_name === 'PermissionRequest';
  if (!blocking) return;
  const requestId = String(Date.now()) + Math.random().toString(16).slice(2, 8);
  fs.writeFileSync(PENDING, JSON.stringify({ requestId, event: data.hook_event_name, tool: data.tool_name, input: data.tool_input }));
  let answer;
  for (;;) {
    try { answer = JSON.parse(fs.readFileSync(ANSWER, 'utf8')); } catch {}
    if (answer && answer.requestId === requestId) break;
    answer = undefined;
    await new Promise((r) => setTimeout(r, 200));
  }
  fs.rmSync(ANSWER, { force: true });
  fs.rmSync(PENDING, { force: true });
  const out = data.hook_event_name === 'PreToolUse'
    ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...data.tool_input, answers: answer.answers } } }
    : { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: answer.decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: 'The user refused this in the app.' } } };
  process.stdout.write(JSON.stringify(out));
});
`,
);
const command = { type: 'command', command: `"${process.execPath}" "${hook}"` };
const blocking = { ...command, timeout: 86400 };
const guidedRule = `Edit(//${guidedDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d: string) => d.toLowerCase())}/**)`;
writeFileSync(
  settings,
  JSON.stringify(
    {
      permissions: { allow: [guidedRule] },
      hooks: {
        PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [blocking] }],
        PermissionRequest: [{ hooks: [blocking] }],
        Stop: [{ hooks: [command] }],
        Notification: [{ hooks: [command] }],
        UserPromptSubmit: [{ hooks: [command] }],
      },
    },
    null,
    2,
  ),
);

type Question = { question: string; header: string; multiSelect: boolean; options: { label: string; description: string }[] };
type HookEvent = { at: number; event: string; data: Record<string, unknown> };
function seen(): HookEvent[] {
  if (!existsSync(events)) return [];
  return readFileSync(events, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HookEvent);
}

function choose(q: Question): string {
  const labels = q.options.map((o) => o.label);
  if (labels.some((l) => /^Gerar/i.test(l))) return labels.find((l) => /cancel/i.test(l)) ?? 'Cancelar';
  if (/onde crio|destino|where/i.test(`${q.header} ${q.question}`)) return destination;
  return labels.find((l) => /recommend|recomend/i.test(l)) ?? labels[0];
}

function permit(tool: string, input: Record<string, unknown>): 'allow' | 'deny' {
  const inside = (p: unknown) => typeof p === 'string' && resolve(p).toLowerCase().startsWith(guidedDir.toLowerCase());
  if ((tool === 'Write' || tool === 'Edit') && inside(input.file_path)) return 'allow';
  if (tool === 'Bash' && /^git (rev-parse|status|log)\b/.test(String(input.command ?? ''))) return 'allow';
  return 'deny';
}

async function main() {
  log(`root: ${root}`);
  log(`allow rule: ${guidedRule}`);
  const bin = resolveClaudeBin(process.env.CLAUDE_BIN ?? 'claude');
  const sessionId = randomUUID();
  const args = ['--add-dir', guidedDir, '--session-id', sessionId, '--settings', settings, '--permission-mode', 'default', `/create --app ${briefPath}`];
  const manager = new TerminalManager({ spawn: claudeSpawner(bin), maxTerminals: 1, scrollbackBytes: 4 << 20 });
  const started = Date.now();
  const rel = () => `+${Math.round((Date.now() - started) / 1000)}s`;
  const info = manager.create({ cwd: workflow, cols: 140, rows: 45, args });
  let exitCode: number | null = null;
  let screen = '';
  manager.attach(info.id, { onData: (d) => (screen += d), onExit: (c) => (exitCode = c) });

  let handledStops = 0;
  let textReplies = 0;
  const deadline = Date.now() + 45 * 60_000;
  while (Date.now() < deadline && exitCode === null && !existsSync(resultPath)) {
    if (/Do you trust|trust this folder/i.test(screen.slice(-4000)) && Date.now() - started < 20_000) {
      log(`${rel()} ⚠️ trust dialog — the Workflow is not a trusted folder; stopping`);
      break;
    }
    if (existsSync(pendingPath)) {
      const pending = JSON.parse(readFileSync(pendingPath, 'utf8')) as { requestId: string; event: string; tool: string; input: Record<string, unknown> };
      if (pending.event === 'PreToolUse') {
        const questions = (pending.input.questions ?? []) as Question[];
        const answers: Record<string, string> = {};
        for (const q of questions) {
          answers[q.question] = choose(q);
          log(`${rel()} QUESTION [${q.header}] ${q.question} — options: ${q.options.map((o) => o.label).join(' | ')}${q.multiSelect ? ' (multi)' : ''}\n      → ${answers[q.question]}`);
        }
        writeFileSync(answerPath, JSON.stringify({ requestId: pending.requestId, answers }));
      } else {
        const decision = permit(pending.tool, pending.input);
        log(`${rel()} PERMISSION ${pending.tool} ${JSON.stringify(pending.input).slice(0, 220)} → ${decision}`);
        writeFileSync(answerPath, JSON.stringify({ requestId: pending.requestId, decision }));
      }
      while (existsSync(pendingPath)) await sleep(100);
    }
    const stops = seen().filter((e) => e.event === 'Stop');
    if (stops.length > handledStops) {
      handledStops = stops.length;
      const last = String(stops.at(-1)?.data.last_assistant_message ?? '');
      log(`${rel()} STOP (turn ended) — last message:\n${last.slice(0, 1500).replace(/^/gm, '      | ')}`);
      await sleep(1500);
      if (existsSync(resultPath)) break;
      if (textReplies >= 3) {
        log(`${rel()} 3 text replies already — stopping`);
        break;
      }
      textReplies++;
      const reply = 'Não sei — deixa em aberto e segue.';
      log(`${rel()} REPLY ${reply}`);
      manager.write(info.id, `\x1b[200~${reply}\x1b[201~`);
      await sleep(300);
      manager.write(info.id, '\r');
    }
    await sleep(300);
  }

  log(`${rel()} done waiting`);
  log(`result.json: ${existsSync(resultPath) ? readFileSync(resultPath, 'utf8') : '(absent)'}`);
  log(`destination created: ${existsSync(destination)} (${destination})`);
  log(`notifications: ${JSON.stringify(seen().filter((e) => e.event === 'Notification').map((e) => e.data.message))}`);
  writeFileSync(join(root, 'screen.txt'), screen);

  manager.write(info.id, '\x03');
  await sleep(400);
  manager.write(info.id, '\x03');
  const exitBy = Date.now() + 8000;
  while (exitCode === null && Date.now() < exitBy) await sleep(100);
  await manager.kill(info.id);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
