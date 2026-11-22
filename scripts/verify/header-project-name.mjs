// The active project's name in the Terminais bar (TerminalsHeader), left of the counts: always visible (sidebar open
// or closed, focus and grid), the most urgent state icon of the project beside it (none without activity), a <button>
// "Mudar de projeto (Alt+B)" that opens the project switcher, and picking another project updates the name. Nothing
// is shown without an active project (a fresh instance has none). The `activity` is replayed on GET /api/terminals
// (Fetch.requestPaused), as in session-state-icons.mjs. Proof by DOM.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/header-project-name.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, openProject, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const BETA = instance.projects.Beta;
const size = { cols: 80, rows: 24 };
const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;

const headerBtn = `document.querySelector('[data-terminals-header] button[data-header-project]')`;
const sidebarBtn = `document.querySelector('aside button[data-project-switcher]')`;
const dialog = `document.querySelector('[role="dialog"][aria-label="Mudar de projeto"]')`;
const nameOf = `(${headerBtn})?.querySelector('span.truncate')?.textContent.trim() ?? ''`;
const iconOf = `(() => { const e = ${headerBtn}?.querySelector('[data-state-icon]'); return e ? { cls: e.querySelector('.state-icon').className.replace('state-icon ', ''), title: e.title } : null; })()`;
const collapsed = `!!document.querySelector('button[aria-label="Mostrar lateral (AltGr+.)"]')`;
const switcherOption = (path) => `[...document.querySelectorAll('[data-switcher-project]')].find((o) => o.dataset.switcherProject === ${JSON.stringify(path)})`;

let listed = [];
let activity = {};
const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/terminals') {
    const body = listed.map((t) => ({ ...t, activity: activity[t.id] ?? null }));
    return void page.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: json(body) });
  }
  return void page.send('Fetch.continueRequest', { requestId });
});

const isAlfa = async () => /alfa/i.test(await page.evaluate(nameOf));
const headerText = () => page.evaluate(`document.querySelector('[data-terminals-header]').innerText.replace(/\\s+/g, ' ')`);
async function pickThroughHeader(path) {
  await page.evaluate(`${headerBtn}.click()`);
  await page.waitFor(`!!${switcherOption(path)}`);
  await page.evaluate(`${switcherOption(path)}.click()`);
  await page.waitFor(`!${dialog}`, 4000);
}
/** Reloads /terminals with the layout / sidebar state / activity, and lands on Alfa (through the sidebar, or the bar when it is closed). */
async function load({ layout = 'focus', map = {}, sidebar = 'open' }) {
  activity = map;
  await page.evaluate(`localStorage.setItem('workflow-app.layout', ${JSON.stringify(layout)}); localStorage.setItem('workflow-app.sidebar-collapsed', ${JSON.stringify(sidebar === 'closed' ? '1' : '0')})`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!document.querySelector('[data-terminal-pane]')`, 15000);
  await page.waitFor(`!!${headerBtn}`, 8000);
  if (sidebar === 'open') await openProject(page, ALFA);
  else if (!(await isAlfa())) await pickThroughHeader(ALFA);
}

let a1, a2, b1;
try {
  check('login', await login(page, instance));

  // ── 0. No active project: nothing in the bar ──
  await page.waitFor(`!!document.querySelector('[data-terminals-header]')`);
  check('no active project → no name button in the bar', (await page.evaluate(`!${headerBtn}`)) && (await page.evaluate(`${sidebarBtn}.textContent.trim() === 'Escolher projeto…'`)));

  a1 = await create(ALFA, 'Alfa um');
  a2 = await create(ALFA, 'Alfa dois');
  b1 = await create(BETA, 'Beta um');
  listed = (await page.api('GET', '/terminals')).body;
  check('the instance lists the 3 terminals', listed.length === 3);
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/terminals', requestStage: 'Request' }] });

  // ── 1. Focus, sidebar open, no activity ──
  await load({});
  const sidebarName = await page.evaluate(`${sidebarBtn}.querySelector('span.truncate').textContent.trim()`);
  check('bar: the name is there and equals the sidebar one', (await page.evaluate(nameOf)) === sidebarName && /alfa/i.test(sidebarName), sidebarName);
  check('bar: a <button> with aria-label and title "Mudar de projeto (Alt+B)"', await page.evaluate(`${headerBtn}.tagName === 'BUTTON' && ${headerBtn}.getAttribute('aria-label') === 'Mudar de projeto (Alt+B)' && ${headerBtn}.title === 'Mudar de projeto (Alt+B)'`));
  check(
    'bar: no box (transparent, no border) and a "▾" in the text-2 colour',
    await page.evaluate(`(() => { const b = ${headerBtn}, s = getComputedStyle(b), arrow = b.querySelector('.anticon-down'); const t2 = document.createElement('i'); t2.className = 'text-text-2'; document.body.append(t2); const want = getComputedStyle(t2).color; t2.remove(); return !!arrow && getComputedStyle(arrow).color === want && s.backgroundColor === 'rgba(0, 0, 0, 0)' && s.borderTopWidth === '0px'; })()`),
  );
  check(
    'bar: the name comes before the counts',
    await page.evaluate(`(() => { const b = ${headerBtn}; const counts = document.querySelector('[data-terminals-header] .state-icon.is-run').closest('span.flex'); return b.getBoundingClientRect().right <= counts.getBoundingClientRect().left; })()`),
    await headerText(),
  );
  check('bar: a "·" separates the name from "Terminais"', /▾?\s*·\s*Terminais/.test(await headerText()) || (await headerText()).includes('·'), await headerText());
  check('bar: no activity → no state icon', (await page.evaluate(iconOf)) === null);

  // ── 2. Most urgent state icon ──
  await load({ map: { [a1.id]: 'working', [a2.id]: 'needs-you' } });
  const icon = await page.evaluate(iconOf);
  check('bar: the icon is the most urgent (needs-you) with the counts', icon?.cls === 'is-wait' && icon.title === '1 precisa de ti · 1 a trabalhar', JSON.stringify(icon));
  const sideIcon = await page.evaluate(`${sidebarBtn}.querySelector('[data-state-icon] .state-icon').className.replace('state-icon ', '')`);
  check('bar icon equals the sidebar project icon', sideIcon === icon?.cls);
  check('bar: the icon sits left of the name', await page.evaluate(`(() => { const b = ${headerBtn}; return b.querySelector('[data-state-icon]').getBoundingClientRect().right <= b.querySelector('span.truncate').getBoundingClientRect().left; })()`));
  await load({ map: { [a1.id]: 'working' } });
  check('bar: only working → the arc', (await page.evaluate(iconOf))?.cls === 'is-work');
  await load({ map: { [b1.id]: 'needs-you' } });
  check('bar: another project needing you does not light this one', (await page.evaluate(iconOf)) === null);

  // ── 3. Sidebar closed ──
  await load({ map: { [a2.id]: 'needs-you' }, sidebar: 'closed' });
  check('closed: the sidebar is really closed', await page.evaluate(collapsed));
  check('closed: the name is still in the bar', await isAlfa());
  check('closed: the icon is still there', (await page.evaluate(iconOf))?.cls === 'is-wait');
  await page.evaluate(`${headerBtn}.click()`);
  check('closed: clicking the name opens the switcher', await page.waitFor(`!!${dialog}`, 4000));
  await page.key('Escape', 'Escape');
  await page.waitFor(`!${dialog}`, 4000);
  const altGr = () => page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Period', key: '.', ctrlKey: true, altKey: true, modifierAltGraph: true, bubbles: true }))`);
  await altGr();
  check('AltGr+. opens the sidebar and the name stays in the bar', (await page.waitFor(`!${collapsed}`, 3000)) && (await isAlfa()));
  await altGr();
  check('AltGr+. closes it again and the name stays', (await page.waitFor(collapsed, 3000)) && (await isAlfa()));

  // ── 4. Grid (classic, closed, one tile enlarged) ──
  await load({ layout: 'grid', map: { [a1.id]: 'waiting' } });
  check('grid: the name and the icon are in the bar', (await isAlfa()) && (await page.evaluate(iconOf))?.cls === 'is-idle');
  await load({ layout: 'grid', sidebar: 'closed' });
  check('grid + closed: the name is in the bar', await isAlfa());
  await page.evaluate(`document.querySelector('[data-terminal-pane="${a1.id}"] [data-pane-button="view"]').click()`);
  check('grid, one tile enlarged: the name is still there', (await page.waitFor(`!document.querySelector('[data-terminal-pane="${a2.id}"]').checkVisibility()`, 3000)) && (await isAlfa()));

  // ── 5. Click → switcher; Alt+B too; picking another project updates the name ──
  await load({});
  await page.evaluate(`${headerBtn}.click()`);
  check('click on the name opens the switcher', await page.waitFor(`!!${dialog}`, 4000));
  check('…and the button says it is open (aria-expanded)', await page.evaluate(`${headerBtn}.getAttribute('aria-expanded') === 'true'`));
  await page.evaluate(`${switcherOption(BETA)}.click()`);
  check('picking Beta updates the name in the bar', await page.waitFor(`/beta/i.test(${nameOf})`, 4000), await page.evaluate(nameOf));
  check('…and in the sidebar, consistently', await page.evaluate(`/beta/i.test(${sidebarBtn}.querySelector('span.truncate').textContent)`));
  await page.key('KeyB', 'b', 1);
  check('Alt+B opens the same switcher', await page.waitFor(`!!${dialog}`, 4000));
  await page.evaluate(`${switcherOption(ALFA)}.click()`);
  check('picking Alfa again brings the name back', await page.waitFor(`/alfa/i.test(${nameOf})`, 4000));

  // ── 6. A long name is truncated and does not push the counts out ──
  await page.evaluate(`${headerBtn}.querySelector('span.truncate').textContent = 'um-nome-de-projeto-muito-muito-muito-comprido-para-caber-na-barra-dos-terminais'`);
  check(
    'long name: ellipsis, the button stays within its max width, the counts stay on screen',
    await page.evaluate(`(() => { const b = ${headerBtn}, s = b.querySelector('span.truncate'); return getComputedStyle(s).textOverflow === 'ellipsis' && s.scrollWidth > s.clientWidth && b.getBoundingClientRect().width <= 261 && document.querySelector('[data-terminals-header] .state-icon.is-run').getBoundingClientRect().right < window.innerWidth; })()`),
  );

  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
