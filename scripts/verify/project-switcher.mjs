// The IDE frame (ADR 0036): a 32 px title bar whose brand cell lines up with the sidebar, the navigation on the
// left, no project tabs, and the project switcher — opened by the project name in the sidebar and by Alt+B
// (also with the keyboard inside a terminal), search, Enter, Esc, click outside. Picking a project only activates
// it — an empty one gets no terminal by itself (confirmed on the API) until "+ Novo terminal aqui".
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-switcher.mjs [run dir] [screenshot.png]
//   node scripts/verify/instance.mjs stop --clean
import { writeFileSync } from 'node:fs';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const shot = process.argv[3];
const { check, finish } = checker();
const page = await openBrowser();

const dialog = `document.querySelector('[role="dialog"][aria-label="Mudar de projeto"]')`;
const switcherButton = `document.querySelector('button[data-project-switcher]')`;
const sidebarName = `${switcherButton}?.textContent.trim()`;
const altB = () => page.key('KeyB', 'b', 1);
const terminalCount = async () => {
  const { body } = await page.api('GET', '/terminals');
  return (Array.isArray(body) ? body : body?.terminals ?? []).length;
};
async function newHere() {
  const button = `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+ Novo terminal aqui')`;
  await page.waitFor(`!!${button}`);
  await page.evaluate(`${button}.click()`);
}
async function waitForCount(expected, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await terminalCount()) === expected) return true;
    await sleep(150);
  }
  return false;
}

try {
  check('login', await login(page, instance));
  check('the sidebar is rendered', await page.waitFor(`!!document.querySelector('nav[aria-label="Terminais do projeto"]')`));

  const frame = await page.evaluate(`(() => {
    const header = document.querySelector('header');
    const brand = header.querySelector('a[aria-label^="Workflow"]');
    const aside = document.querySelector('aside[data-project], aside');
    return { header: header.getBoundingClientRect().height, brand: brand.getBoundingClientRect().right, aside: aside.getBoundingClientRect().right,
      nav: [...document.querySelectorAll('nav[aria-label="Navegação principal"] a')].map((a) => a.textContent.trim()),
      navLeft: document.querySelector('nav[aria-label="Navegação principal"]').getBoundingClientRect().left,
      tabs: !!document.querySelector('[role="tablist"][aria-label="Projetos abertos"]'),
      favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href') };
  })()`);
  check('the title bar is 32 px', Math.round(frame.header) === 33 || Math.round(frame.header) === 32, String(frame.header));
  check('the brand cell ends where the sidebar ends', Math.abs(frame.brand - frame.aside) < 1, `${frame.brand} vs ${frame.aside}`);
  check('the navigation starts right after the brand cell', Math.abs(frame.navLeft - frame.brand) < 1, `${frame.navLeft}`);
  check('the navigation has the five items', frame.nav.join('|') === 'Terminais|Projetos|Biblioteca|Upwork|Novo projeto', frame.nav.join('|'));
  check('no project tabs any more', !frame.tabs);
  check('the favicon is the new mark', frame.favicon === '/favicon.svg', String(frame.favicon));
  check('no active project on a fresh instance', (await page.evaluate(sidebarName)) === 'Escolher projeto…', await page.evaluate(sidebarName));
  check('the sidebar shows the Alt+B hint', await page.evaluate(`[...document.querySelectorAll('aside kbd')].some((k) => k.textContent === 'Alt+B')`));

  // Alt+B opens it with the search focused; typing filters; Enter picks — an empty project gets its first terminal.
  await altB();
  check('Alt+B opens the switcher', await page.waitFor(`!!${dialog}`));
  check('the search has the focus', await page.waitFor(`document.activeElement?.getAttribute('aria-label') === 'Procurar projeto'`));
  const listed = await page.evaluate(`[...${dialog}.querySelectorAll('[role="option"]')].length`);
  check('every seeded project is listed', listed >= Object.keys(instance.projects).length, String(listed));
  await page.send('Input.insertText', { text: 'gam' });
  check('typing filters to Gama', await page.waitFor(`(() => { const o = [...${dialog}.querySelectorAll('[role="option"]')]; return o.length === 1 && o[0].textContent.includes('Gama'); })()`));
  const before = await terminalCount();
  await page.key('Enter', 'Enter', 0, 13);
  check('Enter closes the switcher', await page.waitFor(`!${dialog}`));
  check('the sidebar now belongs to Gama', await page.waitFor(`${sidebarName} === 'Gama'`), await page.evaluate(sidebarName));
  await sleep(1200);
  check('picking an empty project creates no terminal by itself', (await terminalCount()) === before, String(await terminalCount()));
  await newHere();
  check('"+ Novo terminal aqui" opens its first one', await waitForCount(before + 1));

  // The project name is the button: click opens, click again closes (no close-then-reopen flicker).
  await page.evaluate(`${switcherButton}.click()`);
  check('clicking the project name opens it', await page.waitFor(`!!${dialog}`));
  await page.evaluate(`${switcherButton}.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await page.evaluate(`${switcherButton}.click()`);
  check('clicking the project name again closes it', await page.waitFor(`!${dialog}`));

  await altB();
  await page.waitFor(`!!${dialog}`);
  await page.key('Escape', 'Escape', 0, 27);
  check('Esc closes it', await page.waitFor(`!${dialog}`));

  await altB();
  await page.waitFor(`!!${dialog}`);
  await page.evaluate(`document.querySelector('main, body').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  check('a click outside closes it', await page.waitFor(`!${dialog}`));

  // With the keyboard inside the terminal, Alt+B still reaches the app (xterm refuses bound combinations).
  check('the terminal mounted', await page.waitFor(`!!document.querySelector('.xterm-helper-textarea')`));
  await page.evaluate(`document.querySelector('.xterm-helper-textarea').focus()`);
  await altB();
  check('Alt+B from inside a terminal opens the switcher', await page.waitFor(`!!${dialog}`));
  // Arrows + Enter, on Alfa (the first of the empty ones, after Gama that now has a terminal).
  const alfaIndex = await page.evaluate(`[...${dialog}.querySelectorAll('[role="option"]')].findIndex((o) => o.textContent.includes('Alfa'))`);
  for (let i = 0; i < alfaIndex; i += 1) await page.key('ArrowDown', 'ArrowDown', 0, 40);
  check('the arrows move the highlight to Alfa', await page.waitFor(`${dialog}.querySelector('[role="option"][aria-selected="true"]')?.textContent.includes('Alfa')`));
  const beforeAlfa = await terminalCount();
  await page.key('Enter', 'Enter', 0, 13);
  check('the sidebar now belongs to Alfa', await page.waitFor(`${sidebarName} === 'Alfa'`), await page.evaluate(sidebarName));
  await newHere();
  check('Alfa gets its first terminal from the empty state', await waitForCount(beforeAlfa + 1));

  // Back to Gama: a project with terminals is only activated, nothing new is created.
  await altB();
  await page.waitFor(`!!${dialog}`);
  check('projects with terminals come first, the current one marked', await page.evaluate(`(() => {
    const o = [...${dialog}.querySelectorAll('[role="option"]')];
    return o[0].textContent.includes('Gama') || o[0].textContent.includes('Alfa');
  })()`));
  const beforeBack = await terminalCount();
  await page.evaluate(`[...${dialog}.querySelectorAll('[role="option"]')].find((o) => o.textContent.includes('Gama')).click()`);
  check('the sidebar is Gama again', await page.waitFor(`${sidebarName} === 'Gama'`));
  await sleep(1200);
  check('switching to a project with terminals creates none', (await terminalCount()) === beforeBack, String(await terminalCount()));

  if (shot) {
    await altB();
    await page.waitFor(`!!${dialog}`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(shot, Buffer.from(data, 'base64'));
    await page.key('Escape', 'Escape', 0, 27);
  }

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
