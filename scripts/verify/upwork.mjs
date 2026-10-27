// The Upwork section end to end (spec docs/features/upwork.md, "Como sei que está bem feito"), with the skill simulated:
// the instance's claude has no login, so the scenario writes what /upwork-proposal and the guided hook would write —
// a pending question (pending-<id>.json with a live PID), event.json, the session's .jsonl and the package files.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh --git-workflow     (the Workflow has to be inside ALLOWED_ROOTS)
//   node scripts/verify/upwork.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const q = (value) => JSON.stringify(value);
const click = (expr) => page.evaluate(`(${expr}).click()`);
const button = (label, scope = 'document') => `[...${scope}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${q(label)})`;
const has = (text, scope = 'document.body') => `${scope}.innerText.includes(${q(text)})`;
const detail = `document.querySelector('[aria-label="Candidatura aberta"]')`;
const list = `document.querySelector('ul[aria-label="Candidaturas"]')`;
const cards = `document.querySelectorAll('ul[aria-label="Candidaturas"] li')`;
const drawerTitles = `[...document.querySelectorAll('.ant-drawer-open h2')].map((h) => h.textContent).join('|')`;
const dialog = (title) => `[...document.querySelectorAll('.ant-modal')].find((m) => m.innerText.includes(${q(title)}))`;
const tab = (label) => click(`[...document.querySelectorAll('.ant-tabs-tab')].find((t) => t.textContent.trim() === ${q(label)})`);
const chooseStatus = async (label) => {
  await page.evaluate(`document.querySelector('#upwork-status').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await page.waitFor(`!!document.querySelector('.ant-select-item-option[title=${q(label)}]')`);
  await click(`document.querySelector('.ant-select-item-option[title=${q(label)}]')`);
};
const save = async () => {
  await page.waitFor(`!${button('Gravar', detail)}.disabled`);
  await click(button('Gravar', detail));
};
const noTerminal = async (when) => check(`no terminal on the page (${when})`, await page.evaluate(`!document.querySelector('.xterm, .terminal-host')`));
const openUpwork = async () => {
  await click(`document.querySelector('header a[href="/upwork"]')`);
  await page.waitFor(`location.pathname === '/upwork'`);
};

// What the skill and the hook write, by hand.
const guidedDir = (gid) => join(instance.dataDir, 'guided', gid);
const writeEvent = (gid, name) => writeFileSync(join(guidedDir(gid), 'event.json'), JSON.stringify({ event: name, at: new Date().toISOString() }));
const PARTS = {
  'analysis.md': '**Vale a pena: sim.** Cliente com pagamento verificado e 12 contratações.',
  'cover-letter.md': 'Hi! I built a logistics dashboard last month — Estante shows it.\n\nI can start tomorrow.',
  'screening.md': '## 1. Have you used Recharts?\nYes, in Estante.',
  'plan.md': '- React + Recharts\n- 3 dias',
  'client-questions.md': '1. Which carriers?\n2. Who logs in?',
};
const writePackage = (gid, parts) => {
  for (const [name, body] of Object.entries(parts)) writeFileSync(join(guidedDir(gid), name), body);
  const files = { analysis: 'analysis.md', coverLetter: 'cover-letter.md', screening: 'screening.md', plan: 'plan.md', clientQuestions: 'client-questions.md' };
  const manifest = { version: 1, title: 'Logistics dashboard (React)', language: 'en', verdict: 'apply', updatedAt: new Date().toISOString(), files };
  writeFileSync(join(guidedDir(gid), 'package.json'), JSON.stringify(manifest));
};

try {
  check('anonymous /api/upwork/applications is refused', (await fetch(`${instance.base}/api/upwork/applications`)).status === 401);
  check('login', await login(page, instance));
  await page.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: instance.base });

  // Header and the empty states.
  const order = await page.evaluate(`[...document.querySelectorAll('nav[aria-label="Criar"] a')].map((a) => a.textContent).join('|')`);
  check('Upwork sits left of Novo projeto', order === 'Upwork|Novo projeto', order);
  await openUpwork();
  check('no profile → asks for it', await page.waitFor(has('Preenche o teu perfil primeiro')));

  // Perfil: Nova candidatura without a profile leads there; the template saves.
  await click(button('Nova candidatura', `document.querySelector('main')`));
  check('Nova candidatura without profile opens Perfil', await page.waitFor(`${drawerTitles} === 'Perfil'`));
  await page.type('#upwork-profile', 'Sou dev React, a começar na Upwork. ');
  await page.waitFor(`!${button('Gravar')}.disabled`);
  await click(button('Gravar'));
  check('profile saved → paste a job', await page.waitFor(`!document.querySelector('.ant-drawer-open') && ${has('Cola um anúncio da Upwork para começar')}`));

  // Nova candidatura: the post goes verbatim to job.md, without the link.
  await click(button('Nova candidatura', `document.querySelector('main')`));
  await page.waitFor(`${drawerTitles} === 'Nova candidatura'`);
  await page.type('#upwork-job', 'React dashboard for a logistics startup\nBudget $500, stack {React, Recharts}.');
  await page.type('#upwork-screening', 'Have you used Recharts?');
  await page.type('#upwork-url', 'https://www.upwork.com/jobs/~01abc');
  await page.waitFor(`!${button('Gerar')}.disabled`);
  await click(button('Gerar'));
  check('Gerar opens the new application', await page.waitFor(`${list}?.querySelector('button[aria-current="true"]')?.innerText.includes('React dashboard')`, 20000));
  const app = (await page.api('GET', '/upwork/applications')).body[0];
  const gid = app.guidedId;
  const job = readFileSync(join(guidedDir(gid), 'job.md'), 'utf8');
  check('job.md: the post verbatim, the question, no link', job.includes('Budget $500, stack {React, Recharts}.') && job.includes('1. Have you used Recharts?') && !job.includes('upwork.com/jobs'), job);

  // Generating: cards waiting, the conversation under them, a question from the skill right there.
  check('generating: cards waiting and Claude working', await page.waitFor(`${has('em espera', detail)} && ${has('O Claude está a trabalhar', detail)}`));
  await noTerminal('generating');
  const requestId = randomUUID();
  const pendingFile = join(guidedDir(gid), `pending-${requestId}.json`);
  const question = { question: 'Que projeto mostras?', header: 'Prova', multiSelect: false, options: [{ label: 'Estante', description: 'O dashboard' }, { label: 'Outro', description: '—' }] };
  writeFileSync(pendingFile, JSON.stringify({ type: 'question', requestId, pid: process.pid, at: new Date().toISOString(), questions: [question] }));
  check('a question from the skill shows in Pacote', await page.waitFor(`${has('Que projeto mostras?', detail)} && !!${detail}.querySelector('[role="radio"]')`, 15000));
  rmSync(pendingFile);

  // The package arrives, and a proposed reply in the conversation.
  const meta = JSON.parse(readFileSync(join(guidedDir(gid), 'meta.json'), 'utf8'));
  const transcriptDir = join(instance.claudeDir, 'projects', instance.workflowPath.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(transcriptDir, { recursive: true });
  const reply = { type: 'assistant', uuid: randomUUID(), timestamp: new Date().toISOString(), message: { id: 'msg_1', role: 'assistant', content: [{ type: 'text', text: 'Proposed reply: **Thanks for the details!**' }] } };
  writeFileSync(join(transcriptDir, `${meta.claudeSessionId}.jsonl`), `${JSON.stringify(reply)}\n`);
  writePackage(gid, PARTS);
  writeEvent(gid, 'Stop');
  check('five package cards', await page.waitFor(`${detail}.querySelectorAll('section.card').length === 5`, 15000));
  check('title and verdict reach the list', await page.waitFor(`${has('Logistics dashboard (React)', list)} && ${has('Candidatar', list)}`));
  const letter = `[...${detail}.querySelectorAll('section.card')].find((s) => s.getAttribute('aria-label') === 'Carta')`;
  await click(`[...${letter}.querySelectorAll('button')].find((b) => b.textContent.includes('Copiar'))`);
  check('Copiar → Copiado', await page.waitFor(`${letter}.innerText.includes('Copiado')`));
  // The Windows clipboard turns \n into \r\n — the text is still the raw Markdown.
  const clip = await page.evaluate('navigator.clipboard.readText()');
  check('the clipboard has the raw Markdown', clip.replaceAll('\r\n', '\n') === PARTS['cover-letter.md'], q(clip));
  writePackage(gid, { ...PARTS, 'cover-letter.md': 'Shorter letter. Estante.' });
  check('a revision updates the card', await page.waitFor(`${letter}?.innerText.includes('Shorter letter.')`, 15000));

  await tab('Conversa');
  check('Conversa: the reply, with Copiar, and the reply box', await page.waitFor(`${has('Thanks for the details!', detail)} && [...${detail}.querySelectorAll('[role="log"] button')].some((b) => b.textContent.includes('Copiar')) && !!${detail}.querySelector('textarea')`));
  await noTerminal('conversation');

  // Enviada with 12 Connects: the session pauses.
  await tab('Dados');
  await page.waitFor(`!!document.querySelector('#upwork-status')`);
  await chooseStatus('Enviada');
  check('marking Enviada warns it pauses', await page.waitFor(has('Marcar Enviada pausa a sessão', detail)));
  await page.evaluate(`document.querySelector('#upwork-connects').focus()`);
  await page.type('#upwork-connects', '12');
  await save();
  check('Enviada pauses the session', await page.waitFor(`${has('Em pausa', detail)} && ${has('Enviada', list)}`, 15000));

  // The client answers: writing in the conversation wakes the session up.
  await tab('Conversa');
  await page.waitFor(has('Escrever aqui retoma a conversa', detail));
  await page.type(`[aria-label="Candidatura aberta"] textarea`, 'Client: can you do it in 2 days?');
  await click(button('Enviar', detail));
  check('waking: "A retomar a sessão…"', await page.waitFor(has('A retomar a sessão', detail), 5000));
  // No login, so no SessionStart from the hook: the scenario writes it until the wake goes through.
  for (let i = 0; i < 60 && (await page.evaluate(has('A retomar a sessão', detail))); i++) {
    writeEvent(gid, 'SessionStart');
    await sleep(300);
  }
  check('awake: no longer paused', await page.waitFor(`!${has('Em pausa', detail)}`, 20000));
  await noTerminal('after waking');

  // Entrevista, then Ganha: the history keeps each one.
  await tab('Dados');
  await page.waitFor(`!!document.querySelector('#upwork-status')`);
  await chooseStatus('Entrevista');
  await page.type('#upwork-client', 'Acme Logistics');
  await save();
  await page.waitFor(`document.querySelectorAll('[aria-label="Histórico do estado"] li').length === 3`, 10000);
  await chooseStatus('Ganha');
  await save();
  check('history: Rascunho → Enviada → Entrevista → Ganha', await page.waitFor(`document.querySelectorAll('[aria-label="Histórico do estado"] li').length === 4`, 10000));
  const won = (await page.api('GET', `/upwork/applications/${app.id}`)).body;
  check('backend: won, client and Connects', won.status === 'won' && won.clientName === 'Acme Logistics' && won.connectsSpent === 12, q({ s: won.status, c: won.clientName, n: won.connectsSpent }));

  // Criar projeto → Novo projeto with the brief.
  await click(button('Criar projeto', detail));
  await page.waitFor(`!!document.querySelector('#upwork-agreement')`);
  await page.type('#upwork-agreement', 'Fixed price, 2 milestones: charts, then login.');
  await page.waitFor(`!${button('Criar projeto', dialog('O /create recebe tudo'))}.disabled`);
  await click(button('Criar projeto', dialog('O /create recebe tudo')));
  check('Criar projeto → /new-project with the brief', await page.waitFor(`location.pathname === '/new-project' && ${has('Projeto ganho na Upwork')} && ${has('2 milestones')}`, 20000));

  // The creation finishes: Abrir projeto opens a terminal in its folder.
  const projectPath = Object.values(instance.projects)[0];
  const creationId = (await page.api('GET', `/upwork/applications/${app.id}`)).body.creationGuidedId;
  const result = { version: 1, status: 'done', projectPath, projectName: 'proj', summary: 'ok', openDecisions: [], nextStep: null, error: null };
  writeFileSync(join(guidedDir(creationId), 'result.json'), JSON.stringify(result));
  await openUpwork();
  await page.waitFor(`${cards}.length === 1`);
  await click(`${list}.querySelector('button')`);
  check('Abrir projeto once the creation has a folder', await page.waitFor(`!!${button('Abrir projeto', detail)}`, 10000));
  await click(button('Abrir projeto', detail));
  await page.waitFor(`location.pathname === '/terminals'`, 10000);
  const terminals = (await page.api('GET', '/terminals')).body;
  check('a visible terminal in the project folder', terminals.some((t) => t.cwd === projectPath && !t.hidden), q(terminals.map((t) => t.cwd)));

  // Arquivar: the package stays, the session goes; read-only afterwards; Apagar.
  await openUpwork();
  await page.waitFor(`${cards}.length === 1`);
  await click(`${list}.querySelector('button')`);
  await page.waitFor(`!!${button('Arquivar', detail)} && !${button('Arquivar', detail)}.disabled`, 10000);
  await click(button('Arquivar', detail));
  await page.waitFor(`!!${dialog('Arquivar esta candidatura?')}`);
  await click(button('Arquivar', dialog('Arquivar esta candidatura?')));
  check('archived leaves the open list', await page.waitFor(`${cards}.length === 0`, 10000));
  let sessionGone = false;
  for (let i = 0; i < 50 && !sessionGone; i++) {
    sessionGone = !existsSync(guidedDir(gid));
    if (!sessionGone) await sleep(200);
  }
  check('package copied, session folder deleted', sessionGone && existsSync(join(instance.dataDir, 'upwork', 'applications', app.id, 'package', 'package.json')));
  await click(`[...document.querySelectorAll('.filter-chip')].find((b) => b.textContent === 'Arquivadas')`);
  await page.waitFor(`${cards}.length === 1`);
  await click(`${list}.querySelector('button')`);
  check('archived: the package is still there', await page.waitFor(`${detail}.querySelectorAll('section.card').length === 5 && ${has('Arquivada', detail)}`, 10000));
  await tab('Dados');
  check('archived: Dados read-only', await page.waitFor(`!!document.querySelector('#upwork-client')?.disabled && !${button('Gravar', detail)}`));
  await click(button('Apagar', detail));
  await page.waitFor(`!!${dialog('Apagar esta candidatura?')}`);
  await click(button('Apagar', dialog('Apagar esta candidatura?')));
  await page.waitFor(`${cards}.length === 0`, 10000);
  const archived = (await page.api('GET', '/upwork/applications?archived=true')).body;
  check('Apagar: gone from the backend', Array.isArray(archived) && archived.length === 0, q(archived));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
