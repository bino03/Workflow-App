// The Settings page (/settings): reached from the user menu, one title and one index entry per section,
// the index jumps and follows the scroll, the terminal layout is saved in this browser and a shortcut can
// be captured. Needs a fresh instance (it changes a shortcut and the layout).
//
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/settings.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const activeLink = () =>
  page.evaluate(`document.querySelector('[data-settings-index] [aria-current]')?.dataset.settingsLink ?? null`);
const mainScroll = () => page.evaluate(`document.querySelector('main').scrollTop`);

try {
  check('login lands on /terminals', await login(page, instance));

  // 1. The user menu navigates (no drawer).
  await page.evaluate(`document.querySelector('[aria-label="Menu de utilizador"]').click()`);
  check(
    'the user menu has "Definições"',
    await page.waitFor(`[...document.querySelectorAll('.ant-dropdown-menu-item')].some((el) => el.textContent.trim() === 'Definições')`),
  );
  await page.evaluate(
    `[...document.querySelectorAll('.ant-dropdown-menu-item')].find((el) => el.textContent.trim() === 'Definições').click()`,
  );
  check('it navigates to /settings', await page.waitFor(`location.pathname === '/settings'`));
  check('no drawer is opened', await page.evaluate(`!document.querySelector('.ant-drawer-open')`));

  // 2. One section and one index entry per setting, with the same title.
  check('the page has 3 sections', await page.waitFor(`document.querySelectorAll('[data-settings-section]').length === 3`));
  const links = await page.evaluate(
    `[...document.querySelectorAll('[data-settings-link]')].map((el) => el.dataset.settingsLink + ':' + el.textContent.trim()).join('|')`,
  );
  check('the index has 3 entries', links === 'layout:Layout dos terminais|shortcuts:Atalhos|passkeys:Passkeys', links);
  const titles = await page.evaluate(
    `[...document.querySelectorAll('[data-settings-section] > h2')].map((el) => el.textContent.trim()).join('|')`,
  );
  check('the section titles are the index titles', titles === 'Layout dos terminais|Atalhos|Passkeys', titles);
  check('the first entry is marked at the top', (await activeLink()) === 'layout');

  // 3. Clicking jumps, and the mark follows.
  await page.evaluate(`document.querySelector('[data-settings-link="passkeys"]').click()`);
  check('clicking "Passkeys" marks it', await page.waitFor(`document.querySelector('[data-settings-link="passkeys"]')?.hasAttribute('aria-current')`));
  check('the page scrolled', await page.waitFor(`document.querySelector('main').scrollTop > 0`));

  // 4. Scrolling back to the top marks the first one.
  await page.evaluate(`document.querySelector('main').scrollTo({ top: 0 })`);
  check('scrolling to the top marks "Layout dos terminais"', await page.waitFor(`document.querySelector('[data-settings-link="layout"]')?.hasAttribute('aria-current')`));
  check('only one entry is marked', (await page.evaluate(`document.querySelectorAll('[data-settings-index] [aria-current]').length`)) === 1);

  // 5. The layout is saved in this browser.
  await page.evaluate(`document.querySelector('[data-layout="grid"]').click()`);
  check('"Grelha" is checked', await page.waitFor(`document.querySelector('[data-layout="grid"]').getAttribute('aria-checked') === 'true'`));
  check('localStorage has the layout', (await page.evaluate(`localStorage.getItem('workflow-app.layout')`)) === 'grid');

  // 6. Capture a shortcut (Alt+Y for "Ir para a Biblioteca") and read it back from the server.
  await page.evaluate(`document.querySelector('[data-shortcut-id="goLibrary"] button').click()`);
  const opened = await page.waitFor(`!!document.querySelector('[data-shortcut-capture="goLibrary"]')`);
  check('"Alterar" opens the capture', opened);
  if (opened) {
    await page.key('KeyY', 'y', 1);
    const saved = await page.waitFor(`!document.querySelector('[data-shortcut-capture="goLibrary"]')`);
    check('the capture closes after saving', saved);
    const view = await page.api('GET', '/keybindings');
    const bound = view.body?.actions?.find?.((action) => action.id === 'goLibrary')?.binding;
    check('the server has Alt+Y', bound?.modifier === 'alt' && bound?.code === 'KeyY', JSON.stringify(bound));
    check('the page did not navigate away', (await page.evaluate(`location.pathname`)) === '/settings');
    await page.api('POST', '/keybindings/reset');
  }

  // 7. Leaving and coming back works (the page unmounts and mounts again).
  await page.evaluate(`document.querySelector('nav[aria-label="Navegação principal"] a[href="/library"]').click()`);
  check(
    'navigating to /library unmounts the settings page',
    (await page.waitFor(`location.pathname === '/library'`)) && (await page.waitFor(`!document.querySelector('[data-settings-section]')`)),
  );
  await page.evaluate(`document.querySelector('[aria-label="Menu de utilizador"]').click()`);
  await page.waitFor(`[...document.querySelectorAll('.ant-dropdown-menu-item')].some((el) => el.textContent.trim() === 'Definições')`);
  await page.evaluate(
    `[...document.querySelectorAll('.ant-dropdown-menu-item')].find((el) => el.textContent.trim() === 'Definições').click()`,
  );
  const back = await page.waitFor(`location.pathname === '/settings'`);
  const atTop = await page.waitFor(`document.querySelector('main').scrollTop === 0`);
  const top = await mainScroll();
  check('coming back to /settings starts at the top', back && atTop, `scrollTop=${top}`);

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
