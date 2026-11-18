// The message index and the conditional auto-scroll of a guided conversation.
//
// Part 1, on the two real pages of a throwaway instance (Upwork, where the scroll is a <section>, and Novo projeto,
// where it is the <main>): ticks, hover panel, click jumps, scroll-spy, room for the rail. The conversation is
// simulated — the instance's claude has no login, so the scenario writes the .jsonl by hand. That claude exits at
// once, so the session is `stopped` and the page stops polling: new entries cannot arrive there.
// Part 2, on /_guided (dev only, a live fake conversation, scroll = the window): new entries while re-reading or at
// the end, the ↓ button (also above the reply dock), the owner's own message.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh --git-workflow
//   (cd frontend && npx vite --port 7499)        ← in the background; 7401 is the owner's
//   node scripts/verify/guided-index.mjs [run dir] [--preview http://localhost:7499]
//   node scripts/verify/instance.mjs stop --clean
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const args = process.argv.slice(2);
const previewAt = args.indexOf('--preview');
const previewBase = previewAt >= 0 ? args[previewAt + 1] : 'http://localhost:7499';
const runDir = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--preview');
const instance = readInstance(runDir);
const { check, finish } = checker();
const page = await openBrowser({ width: 1600, height: 900 });
const q = (value) => JSON.stringify(value);

const LONG = Array.from({ length: 14 }, (_, i) => `Parágrafo ${i + 1} de uma resposta longa do Claude, para a conversa ter scroll a sério.`).join('\n\n');
const OWNER = [
  'Quero que a app guarde as reservas das aulas.',
  'Os sócios não entram na app.\nSó os funcionários.',
  'Sem Supabase: tudo a correr no portátil do ginásio, sem depender de um serviço externo nem de internet nenhuma.',
  'Pode ser Postgres local.',
];

const transcriptOf = (gid) => {
  const meta = JSON.parse(readFileSync(join(instance.dataDir, 'guided', gid, 'meta.json'), 'utf8'));
  // Both the Upwork skill and /create run in the Workflow folder (guided terminals are not in /terminals).
  const dir = join(instance.claudeDir, 'projects', instance.workflowPath.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  return join(dir, `${meta.claudeSessionId}.jsonl`);
};
const line = (type, content) =>
  JSON.stringify({ type, uuid: randomUUID(), timestamp: new Date().toISOString(), message: type === 'user' ? { role: 'user', content } : { id: `msg_${randomUUID()}`, role: 'assistant', content: [{ type: 'text', text: content }] } });
const writeConversation = (file) =>
  writeFileSync(file, OWNER.flatMap((text, i) => [line('user', text), line('assistant', `**Resposta ${i + 1}.**\n\n${LONG}`)]).join('\n') + '\n');

/** Expressions over the scroll area `A` (an element, or document.scrollingElement for the window). */
const areaExpr = (selector) => {
  const A = selector === 'window' ? 'document.scrollingElement' : `document.querySelector(${q(selector)})`;
  const top = selector === 'window' ? '0' : `${A}.getBoundingClientRect().top`;
  const left = selector === 'window' ? '0' : `${A}.getBoundingClientRect().left`;
  return { A, top, left, fromBottom: `(${A}.scrollHeight - ${A}.scrollTop - ${A}.clientHeight)` };
};
const ticks = `document.querySelectorAll('.msg-index-tick')`;
const current = `[...${ticks}].findIndex((t) => t.classList.contains('is-current'))`;
const jump = `document.querySelector('[data-jump-to-end]')`;
const panelButtons = `[...document.querySelectorAll('[data-msg-index-panel] button')]`;

async function hoverRail() {
  const rail = await page.evaluate(`(() => { const r = document.querySelector('.msg-index-rail').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rail.x, y: rail.y });
}
async function realClick(expression) {
  const box = await page.evaluate(`(() => { const r = (${expression}).getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}

/** The instance's claude exits at once: wait until the page has settled on `stopped` before measuring scrolls. */
async function settled(gid) {
  for (let i = 0; i < 40 && (await page.api('GET', `/guided/${gid}`)).body.status !== 'stopped'; i++) await sleep(250);
  await sleep(3500); // the pages poll every 1.5-3 s: let them see it and re-render
}

/** Part 1: the index itself. `lastText`: the last owner message's first line. */
async function verifyIndex(label, selector, lastText) {
  const { A, top, left, fromBottom } = areaExpr(selector);
  const expected = await page.evaluate(`document.querySelectorAll('[role="log"] .chat-user, [role="log"] .border-l-2.border-accent-border').length`);
  check(`${label}: one tick per owner message (brief included)`, await page.waitFor(`${ticks}.length === ${expected} && ${expected} >= 3`), `${expected}`);
  check(`${label}: it starts at the end`, await page.waitFor(`${fromBottom} < 4`, 8000), await page.evaluate(fromBottom));
  check(`${label}: at the end the last message is current`, await page.waitFor(`${current} === ${ticks}.length - 1`));
  check(`${label}: no ↓ at the end`, await page.evaluate(`!${jump}`));

  const geometry = await page.evaluate(`(() => {
    const r = document.querySelector('.msg-index-rail').getBoundingClientRect();
    const right = ${left} + ${A}.clientWidth, mid = ${top} + ${A}.clientHeight / 2;
    const content = document.querySelector('[role="log"]').getBoundingClientRect();
    return { edge: Math.round(right - r.right), centre: Math.round(Math.abs((r.top + r.bottom) / 2 - mid)), clear: content.right <= r.left };
  })()`);
  check(`${label}: rail on the right edge, centred, clear of the conversation`, geometry.edge === 0 && geometry.centre <= 1 && geometry.clear, q(geometry));
  const tick = await page.evaluate(`[getComputedStyle(${ticks}[${ticks}.length - 1]).backgroundColor, getComputedStyle(${ticks}[0]).backgroundColor, getComputedStyle(${ticks}[${ticks}.length - 1]).width, getComputedStyle(document.documentElement).getPropertyValue('--wfa-color-accent').trim()]`);
  const tickSettled = `(() => { const c = document.querySelector('.msg-index-tick.is-current'), o = document.querySelector('.msg-index-tick:not(.is-current)'); return getComputedStyle(c).backgroundColor === 'rgb(168, 143, 255)' && getComputedStyle(c).width === '18px' && getComputedStyle(o).width === '10px' && getComputedStyle(o).backgroundColor !== 'rgb(168, 143, 255)'; })()`;
  check(`${label}: the current tick is the accent (#A88FFF) and longer (once the transition ends)`, await page.waitFor(tickSettled, 3000), q(tick));

  await hoverRail();
  check(`${label}: hover opens the panel`, await page.waitFor(`!!document.querySelector('[data-msg-index-panel]')`));
  const panel = await page.evaluate(`(() => { const p = document.querySelector('[data-msg-index-panel]').getBoundingClientRect(), r = document.querySelector('.msg-index-rail').getBoundingClientRect(); return { leftOfRail: p.right <= r.left + 1, bg: getComputedStyle(document.querySelector('[data-msg-index-panel]')).backgroundColor }; })()`);
  check(`${label}: the panel floats left of the rail`, panel.leftOfRail, q(panel));
  const lines = await page.evaluate(`${panelButtons}.map((b) => b.textContent)`);
  check(`${label}: one line per message, first line only`, lines.length === expected && lines.at(-1) === lastText && !lines.some((l) => l.includes('\n')), q(lines));
  check(`${label}: the current line is marked`, await page.evaluate(`document.querySelector('[data-msg-index-panel] [aria-current]')?.textContent === ${q(lastText)}`));
  const long = await page.evaluate(`(() => { const b = ${panelButtons}.find((x) => x.scrollWidth > x.clientWidth); return b ? getComputedStyle(b).textOverflow : 'none overflowing'; })()`);
  check(`${label}: a long line is cut with …`, long === 'ellipsis', q(long));

  // Click the second line: it scrolls there and it becomes current; no longer at the end, ↓ shows.
  await realClick(`${panelButtons}[1]`);
  const target = `(document.querySelectorAll('[role="log"] .chat-user')[1].closest('[data-entry-id]').getBoundingClientRect().top - ${top})`;
  check(`${label}: the click scrolls to the message`, await page.waitFor(`${target} >= 0 && ${target} < 60`, 5000), await page.evaluate(target));
  await sleep(1500); // an entry or status change arriving now must not undo the jump
  check(`${label}: and it stays there`, (await page.evaluate(`${target} >= 0 && ${target} < 60`)) === true, await page.evaluate(target));
  check(`${label}: the clicked message is current`, await page.waitFor(`${current} === 1`), await page.evaluate(current));
  check(`${label}: away from the end → ↓ shows`, await page.waitFor(`!!${jump}`));
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 300, y: 450 });
  check(`${label}: leaving closes the panel`, await page.waitFor(`!document.querySelector('[data-msg-index-panel]')`));

  await page.evaluate(`${A}.scrollTo({ top: 0 })`);
  check(`${label}: at the top the first is current`, await page.waitFor(`${current} === 0`), await page.evaluate(`${current} + ' @' + ${A}.scrollTop`));
  await page.evaluate(`${A}.scrollTo({ top: ${A}.scrollHeight })`);
  check(`${label}: scrolled back to the end the last is current`, await page.waitFor(`${current} === ${ticks}.length - 1`));

  await page.evaluate(`document.querySelector('.msg-index-rail').focus()`);
  check(`${label}: focus opens the panel`, await page.waitFor(`!!document.querySelector('[data-msg-index-panel]')`));
  await page.key('Tab', 'Tab', 0, 9);
  check(`${label}: Tab goes into the panel`, await page.evaluate(`!!document.activeElement?.closest('[data-msg-index-panel]')`));
  await page.key('Escape', 'Escape', 0, 27);
  check(`${label}: Escape closes it`, await page.waitFor(`!document.querySelector('[data-msg-index-panel]')`));
  await page.evaluate(`document.activeElement?.blur()`);
}

/** Part 2: new entries, on /_guided. */
async function verifyLive() {
  const { A, fromBottom } = areaExpr('window');
  const click = (id) => page.evaluate(`document.getElementById(${q(id)}).click()`);
  const count = () => page.evaluate(`document.querySelectorAll('[role="log"] [data-entry-id]').length`);
  // Re-reading = somewhere inside the conversation (on /_guided it starts below the other preview components).
  const reading = await page.evaluate(`Math.round(document.querySelector('[role="log"]').getBoundingClientRect().top + scrollY + 400)`);

  await page.evaluate(`${A}.scrollTo({ top: ${A}.scrollHeight })`);
  await page.waitFor(`${fromBottom} < 4`);
  let before = await count();
  await click('add-claude');
  check('/_guided: at the end, a new Claude entry follows', await page.waitFor(`document.querySelectorAll('[role="log"] [data-entry-id]').length === ${before + 1} && ${fromBottom} < 4`, 5000), await page.evaluate(fromBottom));

  await page.evaluate(`${A}.scrollTo({ top: ${reading} })`);
  await sleep(300);
  check('/_guided: re-reading → ↓ shows', await page.waitFor(`!!${jump}`));
  before = await count();
  await click('add-claude');
  await page.waitFor(`document.querySelectorAll('[role="log"] [data-entry-id]').length === ${before + 1}`);
  await sleep(1000);
  check('/_guided: re-reading, a new Claude entry does not pull down', (await page.evaluate(`${A}.scrollTop`)) === reading, await page.evaluate(`${A}.scrollTop`));
  check('/_guided: ↓ still there', await page.evaluate(`!!${jump}`));
  const button = await page.evaluate(`(() => { const r = ${jump}.getBoundingClientRect(); return { bottomGap: Math.round(innerHeight - r.bottom), centred: Math.abs((r.left + r.right) / 2 - document.querySelector('[role="log"]').getBoundingClientRect().left - document.querySelector('[role="log"]').getBoundingClientRect().width / 2) < 30, round: getComputedStyle(${jump}).borderRadius }; })()`);
  check('/_guided: ↓ is round, near the bottom, centred on the conversation', button.bottomGap >= 8 && button.bottomGap <= 40 && button.centred, q(button));
  await page.evaluate(`${jump}.click()`);
  check('/_guided: ↓ goes to the end', await page.waitFor(`${fromBottom} < 4`, 5000));
  check('/_guided: ↓ disappears at the end', await page.waitFor(`!${jump}`));

  // The owner's own message always goes to the end, even while re-reading; and gets its tick.
  const tickCount = await page.evaluate(`${ticks}.length`);
  await page.evaluate(`${A}.scrollTo({ top: ${reading} })`);
  await sleep(300);
  await click('add-mine');
  check('/_guided: my own message goes to the end', await page.waitFor(`${fromBottom} < 4`, 5000), await page.evaluate(fromBottom));
  check('/_guided: and gets its tick, as the current one', await page.waitFor(`${ticks}.length === ${tickCount + 1} && ${current} === ${tickCount}`));

  // Waiting for text: the reply box is stuck to the bottom and ↓ sits above it.
  await click('toggle-waiting-text');
  await page.waitFor(`!!document.querySelector('[data-reply-dock]')`);
  await page.evaluate(`${A}.scrollTo({ top: ${reading} })`);
  check('/_guided: with the reply dock, ↓ shows', await page.waitFor(`!!${jump}`));
  const above = await page.evaluate(`${jump}.getBoundingClientRect().bottom <= document.querySelector('[data-reply-dock]').getBoundingClientRect().top`);
  check('/_guided: ↓ sits above the reply box', above);
  await page.type('[data-reply-dock] textarea', 'Escrevi na caixa.');
  await page.evaluate(`[...document.querySelectorAll('[data-reply-dock] button')].find((b) => b.textContent.includes('Enviar')).click()`);
  check('/_guided: sending from the reply box goes to the end', await page.waitFor(`document.body.innerText.includes('Escrevi na caixa.') && ${fromBottom} < 4`, 5000), await page.evaluate(fromBottom));
}

try {
  check('login', await login(page, instance));

  // Upwork.
  await page.api('PUT', '/upwork/profile', { markdown: 'Sou dev React.' });
  const application = (await page.api('POST', '/upwork/applications', { job: 'Gym bookings app', screeningQuestions: [] })).body;
  writeConversation(transcriptOf(application.guidedId));
  await page.navigate(`${instance.base}/upwork`);
  await page.waitFor(`!!document.querySelector('ul[aria-label="Candidaturas"] button')`);
  await page.evaluate(`document.querySelector('ul[aria-label="Candidaturas"] button').click()`);
  await page.waitFor(`[...document.querySelectorAll('.ant-tabs-tab')].some((t) => t.textContent.trim() === 'Conversa')`);
  await page.evaluate(`[...document.querySelectorAll('.ant-tabs-tab')].find((t) => t.textContent.trim() === 'Conversa').click()`);
  check('Upwork: the conversation arrives', await page.waitFor(`document.body.innerText.includes('Pode ser Postgres local.')`, 20000));
  check('Upwork: room reserved for the rail (full-width section)', await page.waitFor(`!!document.querySelector('.pr-10 > [role="log"]')`));
  await settled(application.guidedId);
  await verifyIndex('Upwork', 'section.overflow-auto', OWNER.at(-1));

  // Novo projeto.
  const creation = (await page.api('POST', '/creations', { description: 'Uma app para as reservas do ginásio.' })).body;
  writeConversation(transcriptOf(creation.id));
  await page.navigate(`${instance.base}/new-project`);
  check('Novo projeto: the conversation arrives', await page.waitFor(`document.body.innerText.includes('Pode ser Postgres local.')`, 20000));
  await settled(creation.id);
  await verifyIndex('Novo projeto', 'main', OWNER.at(-1));
  check('Novo projeto: no room reserved (the 760 px column is far from the rail)', await page.evaluate(`!document.querySelector('.pr-10 > [role="log"]')`));

  // /_guided.
  await page.navigate(`${previewBase}/_guided`);
  check('/_guided: the preview loads', await page.waitFor(`!!document.querySelector('.msg-index-rail')`, 15000));
  await verifyIndex('/_guided', 'window', 'Não, podes criar.');
  await verifyLive();

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack);
} finally {
  await page.close();
}
process.exit(finish());
