// The icons in the header of an EMPTY project in the sidebar (favorite, resume, "+") must not also activate the project,
// which would open a terminal nobody asked for (the "+" opened two). Each action is confirmed on the API, not only on
// screen: the number of terminals. Only visible with the "a correr" filter off, because empty projects hide behind it.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/sidebar-empty-project.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const terminalCount = async () => {
  const { body } = await page.api('GET', '/terminals');
  return (Array.isArray(body) ? body : body?.terminals ?? []).length;
};
const section = (name) => `[...document.querySelectorAll('section[data-project]')].find((s) => s.dataset.project === ${JSON.stringify(instance.projects[name])})`;
const button = (name, label) => `${section(name)}?.querySelector('button[aria-label=${JSON.stringify(label)}]')`;
const click = (name, label) => page.evaluate(`${button(name, label)}.click()`);
// The wrap is `position: fixed` (its `offsetParent` is always null): visible = not `display: none`.
const modalOpen = `[...document.querySelectorAll('.ant-modal-wrap')].some((w) => getComputedStyle(w).display !== 'none')`;

// A real Enter: `keyDown` with `text` fires keydown, keypress and the button's click, like a user at the keyboard.
async function pressEnterOn(name, label) {
  await page.evaluate(`${button(name, label)}.focus()`);
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  }
}

try {
  check('login', await login(page, instance));
  check('the sidebar is rendered', await page.waitFor(`!!document.querySelector('nav[aria-label="Projetos"]')`));
  // Nothing is running on a fresh instance: the default filter hides every project, and this button clears it.
  await page.waitFor(`[...document.querySelectorAll('nav[aria-label="Projetos"] button')].some((b) => b.textContent.trim() === 'Ver todos os projetos')`);
  await page.evaluate(`[...document.querySelectorAll('nav[aria-label="Projetos"] button')].find((b) => b.textContent.trim() === 'Ver todos os projetos').click()`);
  check('the empty projects show with the filter off', await page.waitFor(`${section('Alfa')} !== undefined && ${section('Gama')} !== undefined`));

  const before = await terminalCount();
  check('no terminals to start with', before === 0, String(before));

  await click('Alfa', 'Marcar como favorita');
  await sleep(1200);
  check('the star does not open a terminal', (await terminalCount()) === before, String(await terminalCount()));
  check('the star did mark the project', await page.waitFor(`!!${button('Alfa', 'Tirar das favoritas')}`));

  await pressEnterOn('Alfa', 'Tirar das favoritas');
  await sleep(1200);
  check('Enter on the star does not open a terminal either', (await terminalCount()) === before, String(await terminalCount()));
  check('Enter on the star did toggle it back', await page.waitFor(`!!${button('Alfa', 'Marcar como favorita')}`));

  await click('Beta', 'Retomar uma sessão desta pasta…');
  check('resume opens its modal', await page.waitFor(modalOpen));
  await sleep(1200);
  check('resume does not open a terminal besides the modal', (await terminalCount()) === before, String(await terminalCount()));
  await page.key('Escape', 'Escape', 0, 27);
  check('Esc still closes the modal (it must keep rising)', await page.waitFor(`!(${modalOpen})`));

  await click('Gama', 'Novo terminal em Gama');
  check('"+" opens a terminal', await page.waitFor(`true`) && (await waitForCount(before + 1)));
  await sleep(2500);
  check('"+" opens exactly one (it used to open two)', (await terminalCount()) === before + 1, String(await terminalCount()));

  // The header itself must keep working: it is what opens a project.
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!document.querySelector('nav[aria-label="Projetos"]')`);
  // A terminal is running now, so the filter shows only its project: the "a correr" chip clears it.
  await page.waitFor(`!!document.querySelector('[role="group"][aria-label="Filtrar por status"] button[aria-pressed="true"]')`);
  await page.evaluate(`document.querySelector('[role="group"][aria-label="Filtrar por status"] button[aria-pressed="true"]').click()`);
  check('the empty project shows again with the filter off', await page.waitFor(`${section('Alfa')} !== undefined`));
  const beforeHeader = await terminalCount();
  await page.evaluate(`${section('Alfa')}.querySelector('header').click()`);
  check('clicking the header itself still opens one in an empty project', await waitForCount(beforeHeader + 1));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());

async function waitForCount(expected, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await terminalCount()) === expected) return true;
    await sleep(150);
  }
  return false;
}
