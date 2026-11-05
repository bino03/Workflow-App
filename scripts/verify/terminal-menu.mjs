// The terminals' context menu: right click on a terminal in the sidebar and on its header, never on the text area.
// Each action is confirmed on the API or the DOM. No prompt reaches the model.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/terminal-menu.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const BETA = instance.projects.Beta;
const size = { cols: 80, rows: 24 };

const sidebarItem = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const header = (id) => `${pane(id)}.querySelector('header')`;
const openMenu = `document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu')`;
const menuItems = `[...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item, .ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-submenu-title')]`;
const paneVisible = (id) => `${pane(id)}.checkVisibility()`;

/** A real right click at the middle of the element: the browser decides what gets the contextmenu event. */
async function rightClick(element) {
  await page.evaluate(`${element}.scrollIntoView({ block: 'nearest' })`);
  const { x, y } = await page.evaluate(`(() => { const r = ${element}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'right', clickCount: 1 });
}

const labels = async () => page.evaluate(`${menuItems}.map((e) => e.textContent.trim())`);

async function openOn(element) {
  await page.waitFor(`!${openMenu}`, 3000);
  await rightClick(element);
  return page.waitFor(`!!${openMenu}`, 3000);
}

async function pick(label) {
  await page.waitFor(`${menuItems}.some((e) => e.textContent.trim() === ${JSON.stringify(label)})`);
  await page.evaluate(`${menuItems}.find((e) => e.textContent.trim() === ${JSON.stringify(label)}).click()`);
  await page.waitFor(`!${openMenu}`, 3000);
}

async function closeMenu() {
  await page.key('Escape', 'Escape', 0, 27);
  await page.waitFor(`!${openMenu}`, 3000);
}

async function exitTerminal(id) {
  await page.evaluate(`new Promise((done) => {
    const socket = new WebSocket(location.origin.replace('http', 'ws') + '/api/terminals/${id}/ws');
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
      let sent = 0;
      const timer = setInterval(() => {
        if (socket.readyState === 1) socket.send(new Uint8Array([3]));
        if (++sent === 40) { clearInterval(timer); socket.close(); }
      }, 500);
      done(true);
    };
    socket.onerror = () => done(false);
  })`);
  return page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.find((t) => t.id === ${JSON.stringify(id)}).status === 'exited')`, 25000);
}

const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;
const terminal = async (id) => (await page.api('GET', '/terminals')).body.find((t) => t.id === id);

try {
  check('login', await login(page, instance));
  const a = await create(ALFA, 'Alfa um');
  const b = await create(ALFA, 'Alfa dois');
  const other = await create(BETA, 'Beta um');
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${sidebarItem(other.id)}`);
  await page.evaluate(`${sidebarItem(a.id)}.click()`);
  await page.waitFor(paneVisible(a.id));

  // Where it opens.
  check('right click on the sidebar item opens it', await openOn(sidebarItem(a.id)));
  const running = await labels();
  check('a running terminal: the expected actions, Fechar last', running.join('|') === 'Renomear|Dividir|Pré-visualizar|Fechar', running.join(' | '));
  check('Fechar is the dangerous one', await page.evaluate(`${menuItems}.at(-1).classList.contains('ant-dropdown-menu-item-danger')`));
  await closeMenu();
  check('right click on the header opens it too', await openOn(header(a.id)));
  await closeMenu();
  await page.waitFor(`!!${pane(a.id)}.querySelector('.xterm')`);
  await rightClick(`${pane(a.id)}.querySelector('.terminal-host')`);
  await sleep(500);
  check('not on the text area: copy and paste stay', !(await page.evaluate(`!!${openMenu}`)));

  // Rename, on a terminal that is not on the screen.
  await page.evaluate(`${sidebarItem(a.id)}.click()`);
  await page.waitFor(paneVisible(a.id));
  check('the other one is off screen', !(await page.evaluate(paneVisible(b.id))));
  await openOn(sidebarItem(b.id));
  await pick('Renomear');
  check('Renomear brings it on screen, with the name field', await page.waitFor(`${paneVisible(b.id)} && !!${pane(b.id)}.querySelector('input[aria-label="Nome do terminal"]')`));
  await sleep(300);
  check('the field keeps the keyboard', await page.evaluate(`document.activeElement === ${pane(b.id)}.querySelector('input[aria-label="Nome do terminal"]')`));
  await rightClick(`${pane(b.id)}.querySelector('input[aria-label="Nome do terminal"]')`);
  await sleep(300);
  check('while renaming, the right click is the browser\'s', !(await page.evaluate(`!!${openMenu}`)));
  await page.evaluate(`${pane(b.id)}.querySelector('input[aria-label="Nome do terminal"]').select()`);
  await page.type(`[data-terminal-pane="${b.id}"] input[aria-label="Nome do terminal"]`, 'Alfa renomeado');
  await page.key('Enter', 'Enter', 0, 13);
  check('the new name reaches the API', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.find((t) => t.id === ${JSON.stringify(b.id)}).label === 'Alfa renomeado')`));

  // Split: b is the main one now.
  await openOn(sidebarItem(a.id));
  check('another terminal of the project offers "Ver lado a lado"', (await labels()).includes('Ver lado a lado'));
  await pick('Ver lado a lado');
  check('both on screen', await page.waitFor(`${paneVisible(a.id)} && ${paneVisible(b.id)}`));
  await openOn(header(a.id));
  check('now it offers Juntar', (await labels()).includes('Juntar'));
  await pick('Juntar');
  check('joined: only the main one', await page.waitFor(`${paneVisible(b.id)} && !${paneVisible(a.id)}`));
  await openOn(header(b.id));
  check('the main one offers Dividir', (await labels()).includes('Dividir'));
  await pick('Dividir');
  check('Dividir shows the other one', await page.waitFor(`${paneVisible(a.id)} && ${paneVisible(b.id)}`));
  await page.key('Backslash', '\\', 1, 220);
  check('Alt+\\ still joins', await page.waitFor(`!${paneVisible(a.id)} && ${paneVisible(b.id)}`));

  // A project alone with one terminal cannot split; a terminal of another project opens its tab.
  await openOn(sidebarItem(other.id));
  const betaLabels = await labels();
  check('from another project it offers its own view action', betaLabels.includes('Dividir'), betaLabels.join(' | '));
  check('Dividir is disabled with a single terminal', await page.evaluate(`${menuItems}.find((e) => e.textContent.trim() === 'Dividir').getAttribute('aria-disabled') === 'true'`));
  await closeMenu();

  // Preview: with no dev server, the real error from the backend, not a silent menu.
  await openOn(sidebarItem(b.id));
  await pick('Pré-visualizar');
  check('Pré-visualizar acts: the backend answers with no dev port', await page.waitFor(`!!document.querySelector('.ant-notification-notice')`));
  await page.waitFor(`!document.querySelector('.ant-notification-notice')`, 8000);

  // Close: asks first, on the terminal the menu was opened on, not on the focused one.
  await openOn(sidebarItem(a.id));
  await pick('Fechar');
  const dialog = `[...document.querySelectorAll('.ant-modal-container')].find((m) => m.checkVisibility())`;
  check('Fechar asks first, naming that terminal', await page.waitFor(`/Fechar Alfa um/.test(${dialog}?.innerText ?? '')`));
  check('nothing closed yet', (await terminal(a.id))?.status === 'running');
  await page.evaluate(`[...${dialog}.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Fechar terminal').click()`);
  check('it closes that one', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => !l.some((t) => t.id === ${JSON.stringify(a.id)}))`));
  check('the focused one keeps running', (await terminal(b.id))?.status === 'running');
  await page.waitFor(`!${dialog}`, 3000);

  // Stopped or exited: Reabrir, and no preview.
  await page.evaluate(`${sidebarItem(other.id)}.click()`);
  check('the terminal exits', await exitTerminal(other.id));
  await page.evaluate(`[...document.querySelectorAll('aside .filter-chip')].find((c) => c.getAttribute('aria-pressed') === 'true')?.click()`);
  await page.waitFor(`!!${sidebarItem(other.id)}`);
  await openOn(sidebarItem(other.id));
  const ended = await labels();
  check('one account: Reabrir, no other account, no preview', ended[0] === 'Reabrir' && !ended.includes('Continuar noutra conta') && !ended.includes('Pré-visualizar'), ended.join(' | '));
  await closeMenu();

  // Two accounts: the submenu, with an account without a login disabled, and the same confirmation as the button.
  const extra = (await page.api('POST', '/accounts', { label: 'Trabalho' })).body;
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`[...document.querySelectorAll('aside .filter-chip')].length > 0`);
  await page.evaluate(`[...document.querySelectorAll('aside .filter-chip')].find((c) => c.getAttribute('aria-pressed') === 'true')?.click()`);
  await page.waitFor(`!!${sidebarItem(other.id)}`);
  await page.waitFor(`!!${sidebarItem(other.id)}.querySelector('[data-account-tag]')`);
  const dir = join(instance.dataDir, 'accounts', extra.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.credentials.json'), '{}');
  writeFileSync(join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'trabalho@example.com' } }));
  await openOn(sidebarItem(other.id));
  check('two accounts: Continuar noutra conta', (await labels()).includes('Continuar noutra conta'));
  await sleep(600);
  await page.evaluate(`${menuItems}.find((e) => e.textContent.trim() === 'Continuar noutra conta').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`);
  const sub = `[...document.querySelectorAll('.ant-dropdown-menu-submenu:not(.ant-dropdown-menu-submenu-hidden) .ant-dropdown-menu-item')]`;
  await page.waitFor(`${sub}.some((e) => e.textContent.trim() === 'Trabalho')`);
  check('the submenu lists the account, enabled once logged in', await page.waitFor(`${sub}.find((e) => e.textContent.trim() === 'Trabalho')?.getAttribute('aria-disabled') !== 'true'`, 3000));
  await page.evaluate(`${sub}.find((e) => e.textContent.trim() === 'Trabalho').click()`);
  check('it asks first, like the button', await page.waitFor(`!!document.querySelector('.ant-modal-container [data-context-notice]')?.checkVisibility()`));
  await page.evaluate(`[...${dialog}.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Continuar nesta conta').click()`);
  check('it reopens in that account', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => { const t = l.find((x) => x.id === ${JSON.stringify(other.id)}); return t.status === 'running' && t.accountId === ${JSON.stringify(extra.id)}; })`));

  // Reabrir, and the grid.
  check('the terminal exits again', await exitTerminal(other.id));
  await page.waitFor(`!document.querySelector('.ant-notification-notice')`, 8000);
  await openOn(sidebarItem(other.id));
  await pick('Reabrir');
  check('Reabrir reopens it', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.find((x) => x.id === ${JSON.stringify(other.id)}).status === 'running')`));

  // The grid: enlarge and back, also for a terminal of the project that is not active.
  await page.evaluate(`localStorage.setItem('workflow-app.layout', 'grid')`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${sidebarItem(b.id)}`);
  await page.evaluate(`${sidebarItem(b.id)}.click()`);
  await page.waitFor(paneVisible(b.id));
  check('grid: the header of a tile opens the menu', await openOn(header(b.id)));
  check('grid: it offers Ampliar', (await labels()).includes('Ampliar'));
  await pick('Ampliar');
  check('Ampliar enlarges it: "Voltar à grelha" is next', await page.waitFor(`!document.querySelector('[data-terminal-grid]').classList.contains('grid')`));
  await openOn(header(b.id));
  check('grid: the enlarged one offers Voltar à grelha', (await labels()).includes('Voltar à grelha'));
  await pick('Voltar à grelha');
  check('back to the grid', await page.waitFor(`document.querySelector('[data-terminal-grid]').classList.contains('grid')`));
  await openOn(sidebarItem(other.id));
  await pick('Ampliar');
  check('a terminal of another project opens that project, enlarged', await page.waitFor(`${paneVisible(other.id)} && !${paneVisible(b.id)}`));
  await openOn(sidebarItem(b.id));
  await pick('Renomear');
  check('grid: renaming a terminal hidden by an enlarged one shows it', await page.waitFor(`${paneVisible(b.id)} && !!${pane(b.id)}.querySelector('input[aria-label="Nome do terminal"]')`));
  await sleep(300);
  check('grid: the field keeps the keyboard', await page.evaluate(`document.activeElement === ${pane(b.id)}.querySelector('input[aria-label="Nome do terminal"]')`));
  await page.key('Escape', 'Escape', 0, 27);

  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
