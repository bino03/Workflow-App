// Session state icons (tokens-and-colors §3, decided 2026-11-22): the claude's `activity` (working / needs-you /
// waiting / null) as one icon in the pane header (the old status tag is gone) and in the sidebar list, the most urgent
// state per project (sidebar name, project switcher), the highlight of a hidden terminal that wants the owner, and the
// diamond beside "Terminais" in the top navigation (only for sessions out of sight). The instance's `claude` has no
// login, so no hook ever sets an activity: the scenario replays the GET /api/terminals answer with the activity (and
// one fake `exited` status) set by hand (Fetch.requestPaused). Proof by DOM (classes, titles), in focus and in grid.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/session-state-icons.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, openProject, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const BETA = instance.projects.Beta;
const size = { cols: 80, rows: 24 };
const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;

const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const item = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const iconOf = (root) =>
  `(() => { const e = ${root}?.querySelector('[data-state-icon] .state-icon'); return e ? { cls: e.className.replace('state-icon ', ''), title: e.parentElement.title } : null; })()`;
const headerIcon = (id) => iconOf(`${pane(id)}.querySelector('[data-pane-header]')`);
const sidebarIcon = (id) => iconOf(item(id));
const projectButton = `document.querySelector('button[data-project-switcher]')`;
const diamond = `document.querySelector('[data-terminals-attention]')`;
const diamondIs = (cls, title) =>
  `${diamond}?.querySelector('.state-icon')?.className === 'state-icon ${cls}' && ${diamond}.querySelector('[data-state-icon]').title === ${JSON.stringify(title)}`;
const switcherOption = (path) => `[...document.querySelectorAll('[data-switcher-project]')].find((o) => o.dataset.switcherProject === ${JSON.stringify(path)})`;

// ── The fake list: the real one, with the activity (and one status) chosen per scenario step ──
let listed = [];
let activity = {};
const fakeStatus = {};
const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/terminals') {
    const body = listed.map((t) => ({ ...t, activity: activity[t.id] ?? null, ...(fakeStatus[t.id] ? { status: fakeStatus[t.id] } : {}) }));
    return void page.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: json(body) });
  }
  return void page.send('Fetch.continueRequest', { requestId });
});

let a1, a2, a3, a4, b1;

/** Reloads /terminals in the given layout with the activity map, and lands on Alfa. */
async function load({ layout = 'focus', slots, map }) {
  activity = map;
  const stored = JSON.stringify({ gridStyle: slots ? { kind: 'quad' } : { kind: 'classic' }, slotIds: slots ?? [] });
  await page.evaluate(`localStorage.setItem('workflow-app.layout', ${JSON.stringify(layout)}); localStorage.setItem(${JSON.stringify(`workflow-app.grid-layout.${ALFA}`)}, ${JSON.stringify(stored)})`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!document.querySelector('[data-terminal-pane]')`, 15000);
  await openProject(page, ALFA);
  await page.waitFor(`!!${item(a1.id)}`, 8000);
}

const WAIT_SUBTLE = 'rgb(46, 30, 7)'; // --wfa-state-wait-subtle (#2E1E07), as the browser computes it
const bg = (id) => page.evaluate(`getComputedStyle(${item(id)}).backgroundColor`);
const chipsText = () => page.evaluate(`[...document.querySelectorAll('.filter-chip')].map((c) => c.textContent.trim() + ':' + c.querySelector('.state-icon').className.replace('state-icon ', '')).join('|')`);
const headerCounts = () => page.evaluate(`document.querySelector('[data-terminals-header]').innerText.replace(/\\s+/g, ' ').replace(/ \\d×\\d$/, '').trim()`);
const is = (got, cls, title) => !!got && got.cls === cls && got.title === title;
const noTagInHeaders = `[...document.querySelectorAll('[data-pane-header]')].every((h) => !/A correr|Terminado|Parado|A trabalhar|Precisa de ti|À tua espera/.test(h.innerText.replace(/\\s+/g, ' ')) && !h.querySelector('.tag-run, .tag-stop, .tag-work, .tag-wait'))`;
const navLink = (label) => `[...document.querySelectorAll('nav[aria-label="Navegação principal"] a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)})`;

try {
  check('login', await login(page, instance));
  a1 = await create(ALFA, 'Alfa um');
  a2 = await create(ALFA, 'Alfa dois');
  a3 = await create(ALFA, 'Alfa tres');
  a4 = await create(ALFA, 'Alfa quatro');
  b1 = await create(BETA, 'Beta um');
  listed = (await page.api('GET', '/terminals')).body;
  check('the instance lists the 5 terminals', listed.length === 5, `activities from the real backend: ${listed.map((t) => t.activity).join(',')}`);
  fakeStatus[a4.id] = 'exited'; // not running: the chips and the header counts stay by status
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/terminals', requestStage: 'Request' }] });

  // ── 1. Focus mode, activity null everywhere: the status fallback, nothing lit ──
  await load({ map: {} });
  check('null: running → dot "A correr" in the header', is(await page.evaluate(headerIcon(a1.id)), 'is-run', 'A correr'));
  check('null: exited → square "Terminado" in the header', is(await page.evaluate(headerIcon(a4.id)), 'is-stop', 'Terminado'));
  check('null: sidebar dot + square', is(await page.evaluate(sidebarIcon(a1.id)), 'is-run', 'A correr') && is(await page.evaluate(sidebarIcon(a4.id)), 'is-stop', 'Terminado'));
  check('the header tag is gone', await page.evaluate(noTagInHeaders));
  check('null: no highlight, no diamond, no project icon', await page.evaluate(`!document.querySelector('[data-attention]') && !${diamond} && !${projectButton}.querySelector('[data-state-icon]')`));
  const baseChips = await chipsText();
  const baseCounts = await headerCounts();
  check('chips by status (a correr / terminados)', /3 a correr:is-run\|1 terminados:is-stop/.test(baseChips), baseChips);
  await page.evaluate(`${projectButton}.click()`);
  await page.waitFor(`!!document.querySelector('[data-switcher-project]')`);
  check('null: the switcher keeps the status icons (as before)', await page.evaluate(`(() => { const o = ${switcherOption(ALFA)}; return !o.querySelector('[data-state-icon]') && !!o.querySelector('.state-icon.is-run') && !!o.querySelector('.state-icon.is-stop'); })()`));
  await page.key('Escape', 'Escape');

  // ── 2. Focus mode with the three states ──
  await load({ map: { [a1.id]: 'working', [a2.id]: 'needs-you', [a3.id]: 'waiting' } });
  check('header A1: working → arc "A trabalhar"', is(await page.evaluate(headerIcon(a1.id)), 'is-work', 'A trabalhar'));
  check('header A2: needs-you → solid diamond "Precisa de ti"', is(await page.evaluate(headerIcon(a2.id)), 'is-wait', 'Precisa de ti'));
  check('header A3: waiting → empty diamond "À tua espera"', is(await page.evaluate(headerIcon(a3.id)), 'is-idle', 'À tua espera'));
  check('header A4: activity null falls back to the status', is(await page.evaluate(headerIcon(a4.id)), 'is-stop', 'Terminado'));
  check('the header tag stays gone', await page.evaluate(noTagInHeaders));
  check(
    'sidebar: the 3 states + fallback',
    is(await page.evaluate(sidebarIcon(a1.id)), 'is-work', 'A trabalhar') &&
      is(await page.evaluate(sidebarIcon(a2.id)), 'is-wait', 'Precisa de ti') &&
      is(await page.evaluate(sidebarIcon(a3.id)), 'is-idle', 'À tua espera') &&
      is(await page.evaluate(sidebarIcon(a4.id)), 'is-stop', 'Terminado'),
  );
  check('sidebar keeps pane-N', await page.evaluate(`${item(a2.id)}.textContent.includes('pane-2') && ${item(a3.id)}.textContent.includes('pane-3')`));
  check('hidden + needs-you / waiting → wait-subtle background', (await bg(a2.id)) === WAIT_SUBTLE && (await bg(a3.id)) === WAIT_SUBTLE, `${await bg(a2.id)} ${await bg(a3.id)}`);
  check('the hidden highlight has the wait-border (inset ring)', await page.evaluate(`getComputedStyle(${item(a2.id)}).boxShadow.includes('rgb(120, 78, 13)')`));
  check('in view (A1) and the exited hidden one (A4) are not highlighted', (await bg(a1.id)) !== WAIT_SUBTLE && (await bg(a4.id)) !== WAIT_SUBTLE);
  const projectTitle = await page.evaluate(`${projectButton}.querySelector('[data-state-icon]')?.title`);
  check(
    'sidebar project name: most urgent (needs-you) with the counts',
    (await page.evaluate(`${projectButton}.querySelector('.state-icon')?.className`)) === 'state-icon is-wait' && projectTitle === '1 precisa de ti · 1 à tua espera · 1 a trabalhar',
    projectTitle,
  );
  await page.evaluate(`${projectButton}.click()`);
  await page.waitFor(`!!document.querySelector('[data-switcher-project]')`);
  const sw = await page.evaluate(`(() => { const a = ${switcherOption(ALFA)}, b = ${switcherOption(BETA)}; return { alfa: a.querySelectorAll('.state-icon').length, alfaCls: a.querySelector('.state-icon').className, alfaTitle: a.querySelector('[data-state-icon]').title, betaDot: !!b.querySelector('.state-icon.is-run') && !b.querySelector('[data-state-icon]') }; })()`);
  check('switcher: ONE icon for Alfa, the most urgent, with the counts', sw.alfa === 1 && sw.alfaCls === 'state-icon is-wait' && sw.alfaTitle === '1 precisa de ti · 1 à tua espera · 1 a trabalhar', JSON.stringify(sw));
  check('switcher: Beta (no activity) stays as before', sw.betaDot);
  await page.key('Escape', 'Escape');
  check('nav diamond: solid, lit by the 2 hidden sessions, "working" not counted', await page.evaluate(`${diamond}?.dataset.terminalsAttention === 'needs-you' && ${diamondIs('is-wait', '1 precisa de ti · 1 à tua espera')}`));
  check('nav diamond sits next to "Terminais"', await page.evaluate(`${diamond}.closest('a').textContent.trim() === 'Terminais' && ${diamond}.closest('a').getAttribute('href') === '/terminals'`));
  check('chips and header counts equal to the no-activity run', (await chipsText()) === baseChips && (await headerCounts()) === baseCounts, `${await chipsText()} // ${await headerCounts()}`);

  // ── 3. The diamond: in view does not light it; another project / hidden / another page does ──
  await load({ map: { [a1.id]: 'needs-you' } });
  check('A1 in view and needs you → NO diamond (the pane icon is there)', (await page.evaluate(diamond)) === null && is(await page.evaluate(headerIcon(a1.id)), 'is-wait', 'Precisa de ti'));
  check('…and its sidebar row is not highlighted (it is in view)', (await bg(a1.id)) !== WAIT_SUBTLE);
  await load({ map: { [b1.id]: 'waiting' } });
  check('another project (Beta) waiting → empty diamond', await page.evaluate(diamondIs('is-idle', '1 à tua espera')));
  check('…the Alfa name in the sidebar shows no icon for it', await page.evaluate(`!${projectButton}.querySelector('[data-state-icon]')`));
  await load({ map: { [b1.id]: 'needs-you', [a1.id]: 'waiting' } });
  check('Beta needs you (+ A1 waiting in view) → solid diamond, counts only the one out of sight', await page.evaluate(diamondIs('is-wait', '1 precisa de ti')));
  await load({ map: { [b1.id]: 'working' } });
  check('another project only working → no diamond', (await page.evaluate(diamond)) === null);
  await load({ map: { [a1.id]: 'needs-you' } });
  await page.evaluate(`${navLink('Projetos')}.click()`);
  await page.waitFor(`location.pathname === '/projects'`);
  check('on another page nothing is in view → the diamond lights for A1', await page.waitFor(diamondIs('is-wait', '1 precisa de ti'), 5000));
  await page.evaluate(`${navLink('Terminais')}.click()`);
  check('back on the Terminais with A1 in view → it goes out', await page.waitFor(`!${diamond}`, 5000));

  // ── 4. Grid: quad with A1 and A2 in places, A3 left out ──
  await load({ layout: 'grid', slots: [a1.id, a2.id, null, null], map: { [a1.id]: 'working', [a2.id]: 'needs-you', [a3.id]: 'waiting' } });
  check('grid: A1 and A2 are tiles on screen, A3 is not', await page.evaluate(`${pane(a1.id)}.checkVisibility() && ${pane(a2.id)}.checkVisibility() && !${pane(a3.id)}.checkVisibility()`));
  check('grid tile header A1: arc "A trabalhar"', is(await page.evaluate(headerIcon(a1.id)), 'is-work', 'A trabalhar'));
  check('grid tile header A2: solid diamond "Precisa de ti"', is(await page.evaluate(headerIcon(a2.id)), 'is-wait', 'Precisa de ti'));
  check('grid: no state tag in the compact headers', await page.evaluate(noTagInHeaders));
  check(
    'grid sidebar: the 3 states',
    is(await page.evaluate(sidebarIcon(a1.id)), 'is-work', 'A trabalhar') && is(await page.evaluate(sidebarIcon(a2.id)), 'is-wait', 'Precisa de ti') && is(await page.evaluate(sidebarIcon(a3.id)), 'is-idle', 'À tua espera'),
  );
  check('grid: only the hidden A3 is highlighted (A2 needs you but is in view)', (await bg(a3.id)) === WAIT_SUBTLE && (await bg(a2.id)) !== WAIT_SUBTLE);
  check('grid: the diamond is the empty one (only A3 is out of sight)', await page.evaluate(diamondIs('is-idle', '1 à tua espera')));
  check('grid: chips and header counts unchanged', (await chipsText()) === baseChips && (await headerCounts()) === baseCounts, `${await chipsText()} // ${await headerCounts()}`);
  await page.evaluate(`${pane(a1.id)}.querySelector('[data-pane-button="view"]').click()`);
  check('enlarging A1: only it is in view; the header keeps its icon', (await page.waitFor(`!${pane(a2.id)}.checkVisibility()`, 3000)) && is(await page.evaluate(headerIcon(a1.id)), 'is-work', 'A trabalhar'));
  check('enlarged A1: A2 and A3 are now out of sight → both lit, diamond solid with 2 counts', (await bg(a2.id)) === WAIT_SUBTLE && (await bg(a3.id)) === WAIT_SUBTLE && (await page.evaluate(diamondIs('is-wait', '1 precisa de ti · 1 à tua espera'))));
  await load({ layout: 'grid', map: { [a1.id]: 'waiting', [a2.id]: 'needs-you', [a3.id]: 'working' } });
  check('classic grid (everything in view): no highlight, no diamond', await page.evaluate(`!document.querySelector('[data-attention]') && !${diamond}`));
  check(
    'classic grid: the 3 states in the tile headers',
    is(await page.evaluate(headerIcon(a1.id)), 'is-idle', 'À tua espera') && is(await page.evaluate(headerIcon(a2.id)), 'is-wait', 'Precisa de ti') && is(await page.evaluate(headerIcon(a3.id)), 'is-work', 'A trabalhar'),
  );

  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
