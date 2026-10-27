// The context menu of the Upwork list (right click on an application card): the next status and the exits, each one
// confirmed; Novo projeto on a won application, with the whole application in the brief (questions, conversation,
// notes, an optional agreement); Copiar carta, Abrir anúncio, Arquivar, Apagar. The skill is simulated as in upwork.mjs.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh --git-workflow
//   node scripts/verify/upwork-menu.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const q = (value) => JSON.stringify(value);
const click = (expr) => page.evaluate(`(${expr}).click()`);
const button = (label, scope = 'document') => `[...${scope}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${q(label)})`;
const has = (text, scope = 'document.body') => `${scope}.innerText.includes(${q(text)})`;
const detail = `document.querySelector('[aria-label="Candidatura aberta"]')`;
const cards = `document.querySelectorAll('ul[aria-label="Candidaturas"] li')`;
const card = (title) => `[...${cards}].find((li) => li.innerText.includes(${q(title)})).querySelector('button')`;
const dialog = (title) => `[...document.querySelectorAll('.ant-modal')].find((m) => m.innerText.includes(${q(title)}))`;
const openMenu = `[...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu')].at(-1)`;
const menuLabels = `[...(${openMenu}?.querySelectorAll('.ant-dropdown-menu-item') ?? [])].map((i) => i.textContent.trim()).join('|')`;

/** A real right click (CDP mouse events) in the middle of the card — once no dialog (or its closing mask) covers it. */
const rightClick = async (title) => {
  await page.waitFor(`![...document.querySelectorAll('.ant-modal-wrap, .ant-modal-mask')].some((w) => getComputedStyle(w).display !== 'none')`);
  const { x, y } = await page.evaluate(`(() => { const r = ${card(title)}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'right', buttons: 2, clickCount: 1 });
  return page.waitFor(`!!${openMenu}`);
};
const closeMenu = async () => {
  await page.key('Escape', 'Escape', 0, 27);
  await page.waitFor(`!${openMenu}`);
};
const menuItem = (label) => `[...${openMenu}.querySelectorAll('.ant-dropdown-menu-item')].find((i) => i.textContent.trim() === ${q(label)})`;
const pick = async (label) => {
  await click(menuItem(label));
  await page.waitFor(`!${openMenu}`);
};
const confirmDialog = async (title, action) => {
  const found = await page.waitFor(`!!${dialog(title)}`);
  if (action) await click(button(action, dialog(title)));
  return found;
};
const statusOf = async (id) => (await page.api('GET', `/upwork/applications/${id}`)).body.status;
const waitStatus = async (id, status) => {
  for (let i = 0; i < 50; i++) {
    if ((await statusOf(id)) === status) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};

const guidedDir = (gid) => join(instance.dataDir, 'guided', gid);
const PARTS = {
  'analysis.md': '**Vale a pena: sim.**',
  'cover-letter.md': 'Two screens on one shared database.\n\nHappy to talk.',
  'screening.md': 'No screening questions.',
  'plan.md': '- Next.js + Supabase\n- 5 semanas',
  'client-questions.md': '1. Does strength scale the whole mix?',
};
const writePackage = (gid, title) => {
  for (const [name, body] of Object.entries(PARTS)) writeFileSync(join(guidedDir(gid), name), body);
  const files = { analysis: 'analysis.md', coverLetter: 'cover-letter.md', screening: 'screening.md', plan: 'plan.md', clientQuestions: 'client-questions.md' };
  writeFileSync(join(guidedDir(gid), 'package.json'), JSON.stringify({ version: 1, title, language: 'en', verdict: 'apply', updatedAt: new Date().toISOString(), files }));
  writeFileSync(join(guidedDir(gid), 'event.json'), JSON.stringify({ event: 'Stop', at: new Date().toISOString() }));
};
/** The conversation after the package: a client message pasted by the owner and Claude's proposed reply. */
const writeConversation = (gid) => {
  const meta = JSON.parse(readFileSync(join(guidedDir(gid), 'meta.json'), 'utf8'));
  const dir = join(instance.claudeDir, 'projects', instance.workflowPath.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  const at = new Date().toISOString();
  const lines = [
    { type: 'user', uuid: randomUUID(), timestamp: at, message: { role: 'user', content: 'CLIENT: we need it in 4 weeks, fixed price.' } },
    { type: 'assistant', uuid: randomUUID(), timestamp: at, message: { id: 'msg_1', role: 'assistant', content: [{ type: 'text', text: 'PROPOSED: 4 weeks works, with the customer flow in week 2.' }] } },
  ];
  writeFileSync(join(dir, `${meta.claudeSessionId}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
};

try {
  check('login', await login(page, instance));
  await page.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: instance.base });
  await page.api('PUT', '/upwork/profile', { markdown: '# Quem sou\nDev full-stack.' });
  const created = [];
  for (const job of ['Formula app with QR', 'Mobile app support']) {
    const { body } = await page.api('POST', '/upwork/applications', { job, screeningQuestions: [], url: 'https://www.upwork.com/jobs/~01abc' });
    writePackage(body.guidedId, job);
    created.push(body);
  }
  const [formula, mobile] = created;
  writeConversation(formula.guidedId);

  await page.navigate(`${instance.base}/upwork`);
  await page.waitFor(`${cards}.length === 2`, 15000);

  // Rascunho: the next one, and only Retirada as an exit (a draft never reached the client).
  check('right click opens the menu', await rightClick('Formula app with QR'));
  const draftMenu = await page.evaluate(menuLabels);
  check('draft menu: Enviada, Retirada, Copiar carta, Abrir anúncio', draftMenu === 'Marcar como Enviada|Marcar como Retirada|Copiar carta|Abrir anúncio', draftMenu);
  check('the right click does not select the card', await page.evaluate(`!document.querySelector('ul[aria-label="Candidaturas"] button[aria-current="true"]')`));

  // Cancel leaves it as it was; Marcar changes it, with the history.
  await pick('Marcar como Enviada');
  check('confirmation names the effect (pause)', await confirmDialog('Marcar como Enviada?') && (await page.evaluate(has('entra em pausa', dialog('Marcar como Enviada?')))));
  await click(button('Cancelar', dialog('Marcar como Enviada?')));
  await page.waitFor(`!${dialog('Marcar como Enviada?')} || getComputedStyle(${dialog('Marcar como Enviada?')}).display === 'none'`);
  check('Cancelar: still a draft', (await statusOf(formula.id)) === 'draft');
  await rightClick('Formula app with QR');
  await pick('Marcar como Enviada');
  await confirmDialog('Marcar como Enviada?', 'Marcar');
  check('Marcar: sent in the backend', await waitStatus(formula.id, 'sent'));
  check('the card shows Enviada', await page.waitFor(`${card('Formula app with QR')}.innerText.includes('Enviada')`));

  // The open application follows a change made from the menu.
  await click(card('Formula app with QR'));
  await page.waitFor(`${has('Formula app with QR', detail)}`);
  await rightClick('Formula app with QR');
  check('sent menu: Entrevista, Perdida, Retirada', (await page.evaluate(menuLabels)).startsWith('Marcar como Entrevista|Marcar como Perdida|Marcar como Retirada'), await page.evaluate(menuLabels));
  await pick('Marcar como Entrevista');
  await confirmDialog('Marcar como Entrevista?', 'Marcar');
  check('the open detail updates to Entrevista', await page.waitFor(`[...${detail}.querySelectorAll('h2 + div span')].some((s) => s.textContent === 'Entrevista')`, 10000));
  for (const [next, status] of [['Oferta', 'offer'], ['Ganha', 'won']]) {
    await rightClick('Formula app with QR');
    await pick(`Marcar como ${next}`);
    await confirmDialog(`Marcar como ${next}?`, 'Marcar');
    await waitStatus(formula.id, status);
  }
  const history = (await page.api('GET', `/upwork/applications/${formula.id}`)).body.history.map((h) => h.status).join('>');
  check('history: draft>sent>interview>offer>won', history === 'draft>sent>interview>offer>won', history);

  // Ganha: no next status; Novo projeto; not archivable yet.
  await rightClick('Formula app with QR');
  const wonMenu = await page.evaluate(menuLabels);
  check('won menu: Novo projeto, Copiar carta, Abrir anúncio — no status, no Arquivar', wonMenu === 'Novo projeto|Copiar carta|Abrir anúncio', wonMenu);
  await pick('Copiar carta');
  const clip = await page.evaluate('navigator.clipboard.readText()');
  check('Copiar carta: the raw letter, and a notification', clip.replaceAll('\r\n', '\n') === PARTS['cover-letter.md'] && (await page.waitFor(has('Carta copiada'))), q(clip));

  // Novo projeto: the agreement is optional; the brief carries everything.
  await page.api('PATCH', `/upwork/applications/${formula.id}`, { notes: 'NOTES: pays per milestone.' });
  await rightClick('Formula app with QR');
  await pick('Novo projeto');
  check('Novo projeto opens the agreement modal', await page.waitFor(`!!${dialog('O /create recebe tudo')}`));
  check('an empty agreement is allowed', await page.waitFor(`!${button('Criar projeto', dialog('O /create recebe tudo'))}.disabled`));
  await click(button('Criar projeto', dialog('O /create recebe tudo')));
  check('→ /new-project with the brief', await page.waitFor(`location.pathname === '/new-project' && ${has('Projeto ganho na Upwork')}`, 20000));
  const creationId = (await page.api('GET', `/upwork/applications/${formula.id}`)).body.creationGuidedId;
  const brief = readFileSync(join(guidedDir(creationId), 'brief.md'), 'utf8');
  const parts = ['Formula app with QR', 'Two screens on one shared database.', 'Next.js + Supabase', 'Does strength scale the whole mix?', '**Dono:** CLIENT: we need it in 4 weeks', '**Claude:** PROPOSED: 4 weeks works', 'NOTES: pays per milestone.', 'nenhum acordo colado'];
  const at = parts.map((p) => brief.indexOf(p));
  check('brief: post, letter, plan, questions, conversation, notes, no agreement — in order', at.every((i) => i >= 0) && [...at].sort((a, b) => a - b).join() === at.join(), q(at));

  // With a creation running: Ver criação; once it has a folder: Abrir projeto and Arquivar.
  await page.navigate(`${instance.base}/upwork`);
  await page.waitFor(`${cards}.length === 2`, 15000);
  await rightClick('Formula app with QR');
  check('creation running: Ver criação', (await page.evaluate(menuLabels)).includes('Ver criação'), await page.evaluate(menuLabels));
  await closeMenu();
  const projectPath = Object.values(instance.projects)[0];
  writeFileSync(join(guidedDir(creationId), 'result.json'), JSON.stringify({ version: 1, status: 'done', projectPath, projectName: 'proj', summary: 'ok', openDecisions: [], nextStep: null, error: null }));
  await page.navigate(`${instance.base}/upwork`);
  await page.waitFor(`${cards}.length === 2`, 15000);
  await rightClick('Formula app with QR');
  const doneMenu = await page.evaluate(menuLabels);
  check('project created: Abrir projeto and Arquivar, no Novo projeto', doneMenu === 'Abrir projeto|Copiar carta|Abrir anúncio|Arquivar', doneMenu);
  await closeMenu();

  // An exit: Retirada → Arquivar → (archived list) Apagar.
  await rightClick('Mobile app support');
  await pick('Marcar como Retirada');
  await confirmDialog('Marcar como Retirada?', 'Marcar');
  check('Retirada in the backend', await waitStatus(mobile.id, 'withdrawn'));
  await rightClick('Mobile app support');
  const exitMenu = await page.evaluate(menuLabels);
  check('withdrawn menu: no status, Arquivar', exitMenu === 'Copiar carta|Abrir anúncio|Arquivar', exitMenu);
  await pick('Arquivar');
  await confirmDialog('Arquivar esta candidatura?', 'Arquivar');
  check('archived leaves the open list', await page.waitFor(`${cards}.length === 1`, 10000));
  await click(`[...document.querySelectorAll('.filter-chip')].find((b) => b.textContent === 'Arquivadas')`);
  await page.waitFor(`${cards}.length === 1 && ${has('Mobile app support', 'document.querySelector(\'ul[aria-label="Candidaturas"]\')')}`, 10000);
  await rightClick('Mobile app support');
  const archivedMenu = await page.evaluate(menuLabels);
  check('archived menu: Copiar carta, Abrir anúncio, Apagar', archivedMenu === 'Copiar carta|Abrir anúncio|Apagar', archivedMenu);
  await pick('Apagar');
  await confirmDialog('Apagar esta candidatura?', 'Apagar');
  await page.waitFor(`${cards}.length === 0`, 10000);
  const archived = (await page.api('GET', '/upwork/applications?archived=true')).body;
  check('Apagar: gone from the backend', Array.isArray(archived) && archived.length === 0, q(archived));

  // Keyboard: the menu key (Shift+F10) on a focused card opens the same menu.
  await click(`[...document.querySelectorAll('.filter-chip')].find((b) => b.textContent === 'Arquivadas')`);
  await page.waitFor(`${cards}.length === 1`, 10000);
  await page.evaluate(`${card('Formula app with QR')}.focus()`);
  await page.key('F10', 'F10', 8, 121);
  check('Shift+F10 on a focused card opens the menu', await page.waitFor(`!!${openMenu}`, 3000));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
