// Agents of each terminal (ADR 0031, decided 2026-11-22): only the `running` ones, as a "⑂ n" badge in the pane header
// (also the compact tile header) that opens a short popover list, and as indented sub-lines under the terminal in the
// sidebar TERMINAIS list (max 3 + "+n"). Duration = time running, from `startedAt`, with a ticking clock. The instance's
// `claude` has no login, so no hook ever reports an agent: the scenario replays the GET /api/terminals answer with
// `agents` set by hand (Fetch.requestPaused), like session-state-icons.mjs. The real thing is checked by hand with a
// real `claude` (see whatIveDone).
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/terminal-agents.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, openProject, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const size = { cols: 80, rows: 24 };
const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;

const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const item = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const badge = (id) => `${pane(id)}.querySelector('[data-agents-count]')`;
const subs = (id) => `[...${item(id)}.parentElement.querySelectorAll('[data-agent-subline]')]`;
// An antd popover that just closed stays in the DOM (hidden) for a while: count only the visible list.
const popRows = `[...document.querySelectorAll('[data-agents-list]')].filter((l) => l.checkVisibility()).flatMap((l) => [...l.querySelectorAll('[data-agent-row]')])`;
const text = (el) => `${el}.textContent.replace(/\\s+/g, ' ').trim()`;

// ── The fake list: the real one, with the agents chosen per scenario step ──
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const agent = (id, status, o = {}) => ({ id, description: null, type: null, model: null, status, startedAt: ago(40_000), endedAt: status === 'done' ? ago(1000) : null, ...o });
let listed = [];
let agents = {};
const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/terminals') {
    const body = listed.map((t) => ({ ...t, agents: agents[t.id] ?? [] }));
    return void page.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: json(body) });
  }
  return void page.send('Fetch.continueRequest', { requestId });
});

let a1, a2, a3, a4;
async function load({ layout = 'focus', slots, map }) {
  agents = map;
  const stored = JSON.stringify({ gridStyle: slots ? { kind: 'quad' } : { kind: 'classic' }, slotIds: slots ?? [] });
  await page.evaluate(`localStorage.setItem('workflow-app.layout', ${JSON.stringify(layout)}); localStorage.setItem(${JSON.stringify(`workflow-app.grid-layout.${ALFA}`)}, ${JSON.stringify(stored)})`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!document.querySelector('[data-terminal-pane]')`, 15000);
  await openProject(page, ALFA);
  await page.waitFor(`!!${item(a1.id)}`, 8000);
}
const center = (sel) => page.evaluate(`(() => { const r = ${sel}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const hover = async (sel) => {
  const { x, y } = await center(sel);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 40, y: y + 200 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
};
const popoverOpen = `[...document.querySelectorAll('[data-agents-list]')].some((l) => l.checkVisibility())`;
const closePopover = async () => {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await page.key('Escape', 'Escape');
  await page.waitFor(`!${popoverOpen}`, 3000);
};

const SET = {
  // a1: 3 running (one with model/description null, one only the type) + 1 done that must not count
  a1: () => [
    agent('r1', 'running', { description: 'Contar ficheiros', type: 'Explore', model: 'claude-haiku-4-5-20251001', startedAt: ago(40_000) }),
    agent('r2', 'running', { type: 'general-purpose', startedAt: ago(3 * 60_000 + 5_000) }),
    agent('r3', 'running', { description: 'Rever o plano', type: 'Plan', model: 'claude-sonnet-5-5', startedAt: ago(65 * 60_000 + 30_000) }),
    agent('d1', 'done', { description: 'Já acabou', type: 'Explore', model: 'haiku' }),
  ],
  // a2: 5 running → 3 sub-lines + "+2"
  a2: () => ['x1', 'x2', 'x3', 'x4', 'x5'].map((id, i) => agent(id, 'running', { description: `Tarefa ${i + 1}`, type: 'Explore', model: 'haiku', startedAt: ago((i + 1) * 10_000) })),
  // a3: only done → nothing; a4: none
  a3: () => [agent('d2', 'done', { description: 'Feito', type: 'Explore' }), agent('d3', 'done')],
};

try {
  check('login', await login(page, instance));
  a1 = await create(ALFA, 'Alfa um');
  a2 = await create(ALFA, 'Alfa dois');
  a3 = await create(ALFA, 'Alfa tres');
  a4 = await create(ALFA, 'Alfa quatro');
  listed = (await page.api('GET', '/terminals')).body;
  check('the instance lists the 4 terminals with agents: []', listed.length === 4 && listed.every((t) => Array.isArray(t.agents) && t.agents.length === 0));
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/terminals', requestStage: 'Request' }] });

  // ── 1. Focus mode, nobody has agents: nothing takes room ──
  await load({ map: {} });
  check('zero agents: no badge in any header, no sub-line', await page.evaluate(`!document.querySelector('[data-agents-count]') && !document.querySelector('[data-agent-subline]') && !document.querySelector('[data-agent-sublines]')`));

  // ── 2. Focus mode with agents ──
  await load({ map: { [a1.id]: SET.a1(), [a2.id]: SET.a2(), [a3.id]: SET.a3() } });
  check('badge A1: "⑂3" (the done one does not count)', (await page.evaluate(`${badge(a1.id)} && ${text(badge(a1.id))}`)) === '⑂3' && (await page.evaluate(`${badge(a1.id)}.dataset.agentsCount`)) === '3');
  check('badge A2: "⑂5"', (await page.evaluate(`${badge(a2.id)} && ${text(badge(a2.id))}`)) === '⑂5');
  check('A3 (only done) and A4 (none): no badge', await page.evaluate(`!${badge(a3.id)} && !${badge(a4.id)}`));
  check(
    'the badge is a <button> with an accessible name, a .tag-sm of 18 px in the header',
    await page.evaluate(`(() => { const b = ${badge(a1.id)}; return b.tagName === 'BUTTON' && b.getAttribute('aria-label') === '3 agentes a correr' && !!b.closest('[data-pane-header]') && b.classList.contains('tag-sm') && b.offsetHeight === 18; })()`),
  );
  check(
    'the badge sits after the branch meta and before the buttons',
    await page.evaluate(`(() => { const kids = [...${pane(a1.id)}.querySelector('[data-pane-header]').children]; const i = kids.findIndex((k) => k.matches('[data-agents-count]')); return i > kids.findIndex((k) => k.matches('[data-pane-meta]')) && i < kids.findIndex((k) => k.matches('[data-pane-button]')); })()`),
  );

  // The list, opened by the mouse
  await hover(badge(a1.id));
  check('hover opens the list', await page.waitFor(popoverOpen, 3000));
  const rows = await page.evaluate(
    `${popRows}.map((r) => ({ id: r.dataset.agentRow, title: r.querySelector('[data-agent-title]').textContent, kind: r.querySelector('[data-agent-kind]')?.textContent ?? null, elapsed: r.querySelector('[data-agent-elapsed]').textContent, icon: r.querySelector('.state-icon')?.className }))`,
  );
  check('list has exactly the 3 running rows, oldest first, none of the done', rows.length === 3 && rows.map((r) => r.id).join() === 'r1,r2,r3', JSON.stringify(rows.map((r) => r.id)));
  check('row r1: icon is-work · description · "Explore · haiku-4-5" (date suffix cut)', rows[0].icon === 'state-icon is-work' && rows[0].title === 'Contar ficheiros' && rows[0].kind === 'Explore · haiku-4-5', JSON.stringify(rows[0]));
  check('row r2: description and model null → only the type as title, no kind', rows[1].title === 'general-purpose' && rows[1].kind === null && rows[1].icon === 'state-icon is-work', JSON.stringify(rows[1]));
  check('row r3: "Rever o plano" · "Plan · sonnet-5-5"', rows[2].title === 'Rever o plano' && rows[2].kind === 'Plan · sonnet-5-5', JSON.stringify(rows[2]));
  check('durations: "4x s" · "3 min" · "1 h 5 min"', /^4\d s$/.test(rows[0].elapsed) && rows[1].elapsed === '3 min' && rows[2].elapsed === '1 h 5 min', rows.map((r) => r.elapsed).join(' | '));
  const first = parseInt(rows[0].elapsed, 10);
  check('the clock advances while the list is open (r1 gains seconds)', await page.waitFor(`parseInt(document.querySelector('[data-agent-row="r1"] [data-agent-elapsed]').textContent, 10) >= ${first + 2}`, 6000));
  await closePopover();
  check('mouse out / Esc closes the list', !(await page.evaluate(popoverOpen)));

  // Keyboard: focus + Enter
  await page.evaluate(`${badge(a1.id)}.focus()`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  check('keyboard: focusing the badge and pressing Enter opens the list', await page.waitFor(popoverOpen, 3000));
  await closePopover();
  await page.evaluate(`document.activeElement?.blur()`);
  // Click opens too
  await page.evaluate(`${badge(a2.id)}.click()`);
  const opened = await page.waitFor(popoverOpen, 3000);
  const n = await page.evaluate(`${popRows}.length`);
  check('click opens the list (A2: 5 rows)', opened && n === 5, `rows: ${n}`);
  await closePopover();

  // Sidebar sub-lines
  const s1 = await page.evaluate(
    `${subs(a1.id)}.map((s) => ({ id: s.dataset.agentSubline, text: s.querySelector('.truncate').textContent, title: s.title, elapsed: s.querySelector('[data-agent-elapsed]').textContent, icon: s.querySelector('.state-icon').className, h: s.offsetHeight }))`,
  );
  check('sidebar A1: 3 sub-lines, in order, no "+n"', s1.length === 3 && s1.map((s) => s.id).join() === 'r1,r2,r3' && (await page.evaluate(`!${item(a1.id)}.parentElement.querySelector('[data-agent-more]')`)), JSON.stringify(s1.map((s) => s.id)));
  check('sub-line texts: description, or the type when there is none', s1[0].text === 'Contar ficheiros' && s1[1].text === 'general-purpose' && s1[2].text === 'Rever o plano', JSON.stringify(s1.map((s) => s.text)));
  check('sub-line titles: type · model (short); only the type when the model is null', s1[0].title === 'Explore · haiku-4-5' && s1[1].title === 'general-purpose' && s1[2].title === 'Plan · sonnet-5-5', JSON.stringify(s1.map((s) => s.title)));
  check('sub-line durations on the right', /^4\d s$/.test(s1[0].elapsed) && s1[1].elapsed === '3 min' && s1[2].elapsed === '1 h 5 min', s1.map((s) => s.elapsed).join(' | '));
  check('sub-line icon is-work; lines are lower (20 px) than the terminal row (26 px)', s1.every((s) => s.icon === 'state-icon is-work' && s.h === 20) && (await page.evaluate(`${item(a1.id)}.offsetHeight`)) === 26);
  check(
    'sub-line duration is mono and text-2, "└" present',
    await page.evaluate(`(() => { const s = ${subs(a1.id)}[0]; const e = s.querySelector('[data-agent-elapsed]'); return getComputedStyle(e).fontFamily.toLowerCase().includes('mono') && s.textContent.includes('└') && e.className.includes('text-text-2'); })()`),
  );
  check('sub-line sits BELOW the terminal row', await page.evaluate(`${subs(a1.id)}[0].getBoundingClientRect().top >= ${item(a1.id)}.getBoundingClientRect().bottom - 1`));
  check('sub-line clock ticks (r1 gains seconds)', await page.waitFor(`parseInt(${subs(a1.id)}[0].querySelector('[data-agent-elapsed]').textContent, 10) >= ${parseInt(s1[0].elapsed, 10) + 2}`, 6000));
  const s2 = await page.evaluate(`({ n: ${subs(a2.id)}.length, more: ${item(a2.id)}.parentElement.querySelector('[data-agent-more]')?.textContent.replace(/\\s+/g, '') })`);
  check('sidebar A2 (5 running): 3 sub-lines + "+2"', s2.n === 3 && s2.more === '└+2', JSON.stringify(s2));
  check('A3 (only done) and A4 (none): no sub-line', await page.evaluate(`${subs(a3.id)}.length === 0 && ${subs(a4.id)}.length === 0 && !${item(a3.id)}.parentElement.querySelector('[data-agent-sublines]')`));

  // ── 3. The agents finish: badge and sub-lines go away on the next 10 s re-read ──
  agents = { [a1.id]: SET.a1().map((a) => ({ ...a, status: 'done', endedAt: ago(100) })), [a2.id]: [] };
  check('all done → the counter disappears (zero takes no room) and the sub-lines too', await page.waitFor(`!${badge(a1.id)} && !${badge(a2.id)} && !document.querySelector('[data-agent-sublines]')`, 14000));

  // ── 4. Grid: quad with A1 and A2 in places ──
  await load({ layout: 'grid', slots: [a1.id, a2.id, null, null], map: { [a1.id]: SET.a1(), [a2.id]: SET.a2() } });
  check('grid: A1 and A2 are tiles on screen', await page.evaluate(`${pane(a1.id)}.checkVisibility() && ${pane(a2.id)}.checkVisibility()`));
  check('grid tile header (compact): "⑂3" and "⑂5"', (await page.evaluate(text(badge(a1.id)))) === '⑂3' && (await page.evaluate(text(badge(a2.id)))) === '⑂5');
  await page.evaluate(`${badge(a1.id)}.click()`);
  const gridRows = (await page.waitFor(popoverOpen, 3000)) && (await page.evaluate(`${popRows}.map((r) => r.dataset.agentRow).join()`));
  check('grid: the list opens from the compact header with the 3 running rows', gridRows === 'r1,r2,r3', String(gridRows));
  check('grid: opening the list did not enlarge the tile', await page.evaluate(`${pane(a2.id)}.checkVisibility()`));
  await closePopover();
  check('grid sidebar: sub-lines and "+2" as in focus', (await page.evaluate(`${subs(a1.id)}.length`)) === 3 && (await page.evaluate(`!!${item(a2.id)}.parentElement.querySelector('[data-agent-more]')`)));
  await page.evaluate(`${pane(a1.id)}.querySelector('[data-pane-button="view"]').click()`);
  await page.waitFor(`!${pane(a2.id)}.checkVisibility()`, 3000);
  check('enlarged A1: the badge stays in the header', (await page.evaluate(`${badge(a1.id)}?.textContent.trim()`)) === '⑂3');
  await load({ layout: 'grid', map: { [a1.id]: SET.a1(), [a3.id]: SET.a3() } });
  check('classic grid: A1 badge, A3 (only done) none', await page.evaluate(`!!${badge(a1.id)} && !${badge(a3.id)}`));

  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
