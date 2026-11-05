// The "Escolher conta" drawer (spec contas-do-claude, step 8): the header menu item, adding an account and landing on
// its login terminal (also with /terminals already open), the sidebar quota following the active account, renaming,
// and removing with and without a running terminal. Each action is confirmed on the API, not only on screen. The
// instance's `claude` has no login, so the quota files are written by hand, the way the status line would.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/accounts.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const inHours = (hours) => Math.floor(Date.now() / 1000 + hours * 3600);

function writeUsage(fileName, fiveHourPct, weeklyPct) {
  const data = {
    rate_limits: {
      five_hour: { used_percentage: fiveHourPct, resets_at: inHours(2) },
      seven_day: { used_percentage: weeklyPct, resets_at: inHours(72) },
    },
    fetchedAt: new Date().toISOString(),
  };
  writeFileSync(join(instance.dataDir, fileName), JSON.stringify(data));
}

const clickText = (scope, text) =>
  `[...document.querySelectorAll(${JSON.stringify(scope)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)})?.click()`;
const drawerOpen = `!!document.querySelector('.ant-drawer-open [role="radiogroup"][aria-label="Conta ativa"]')`;
const row = (id) => `document.querySelector('[data-account-id="${id}"]')`;
const sidebar = `document.querySelector('[data-quota="sidebar"]')?.innerText ?? ''`;
const menuLabels = `[...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')].map((e) => e.textContent.trim())`;
const toast = `document.querySelector('.ant-notification-notice')?.innerText ?? ''`;

async function openMenu() {
  await page.evaluate(`document.querySelector('button[aria-label="Menu de utilizador"]').click()`);
  await page.waitFor(`${menuLabels}.length > 0`);
}

async function openDrawer() {
  await openMenu();
  await page.evaluate(`[...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')].find((e) => e.textContent.trim().startsWith('Conta'))?.click()`);
  return page.waitFor(drawerOpen);
}

async function closeDrawer() {
  await page.evaluate(clickText('.ant-drawer-footer button', 'Fechar'));
  await page.waitFor(`!(${drawerOpen})`);
}

const accounts = async () => (await page.api('GET', '/accounts')).body;

async function addAccount(label) {
  await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open button')].find((b) => b.textContent.trim() === 'Adicionar conta').click()`);
  await page.waitFor(`!!document.querySelector('#account-label')`);
  await page.type('#account-label', label);
  await page.waitFor(`!document.querySelector('[data-account-form] button[type="submit"]').disabled`);
  await page.evaluate(`document.querySelector('[data-account-form] button[type="submit"]').click()`);
}

async function removeThroughConfirm(id) {
  await page.evaluate(`[...${row(id)}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remover').click()`);
  await page.waitFor(`[...document.querySelectorAll('.ant-modal-container button')].some((b) => b.textContent.trim() === 'Remover conta')`);
  await page.evaluate(clickText('.ant-modal-container button', 'Remover conta'));
}

try {
  writeUsage('usage.json', 44, 20);
  check('login', await login(page, instance));

  // One account: only the menu item changes.
  await page.waitFor(`/44%/.test(${sidebar})`);
  check('one account: no account name over the sidebar quota', !(await page.evaluate(`!!document.querySelector('[data-quota-account]')`)));
  await openMenu();
  const labels = await page.evaluate(menuLabels);
  check('the item sits right above Definições', labels[0] === 'Conta: Principal' && labels[1] === 'Definições', labels.join(' | '));
  await page.key('Escape', 'Escape', 0, 27);

  check('the item opens the drawer', await openDrawer());
  check('the primary is the checked radio', await page.waitFor(`${row('primary')}?.querySelector('[role="radio"]').getAttribute('aria-checked') === 'true'`));
  check('its quota is in the drawer', /44%/.test(await page.evaluate(`${row('primary')}.innerText`)));
  check('the primary has no Remover', !(await page.evaluate(`[...${row('primary')}.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Remover')`)));

  // A name the backend would refuse never gets there.
  await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open button')].find((b) => b.textContent.trim() === 'Adicionar conta').click()`);
  await page.waitFor(`!!document.querySelector('#account-label')`);
  await page.type('#account-label', 'a<b');
  check('an invalid name is refused in the form', await page.waitFor(`document.querySelector('[data-account-form] button[type="submit"]').disabled && /Só letras/.test(document.querySelector('[data-account-form]').innerText)`));
  await page.evaluate(clickText('[data-account-form] button', 'Cancelar'));

  // Add with /terminals already open: the page does not mount again, and it must still focus the new terminal.
  await addAccount('Trabalho');
  check('adding lands on /terminals with the drawer closed', await page.waitFor(`!(${drawerOpen}) && location.pathname === '/terminals'`));
  // The banner only renders while its terminal is in view, so this also proves the focus.
  check('the login terminal is in view, with the banner naming the account', await page.waitFor(`/conta Trabalho/.test(document.querySelector('[data-login-banner]')?.innerText ?? '')`));
  let view = await accounts();
  const extra = view.accounts.find((a) => a.label === 'Trabalho');
  check('the account exists, with no login, and is not active', extra && !extra.loggedIn && view.activeAccountId === 'primary');
  const terminalsList = (await page.api('GET', '/terminals')).body;
  const loginTerminal = terminalsList.find((t) => t.accountId === extra?.id);
  check('its login terminal runs in that account', loginTerminal?.label === 'Login — Trabalho', loginTerminal?.label);
  check('the navigation state was cleared', (await page.evaluate(`history.state?.usr ?? null`)) === null);

  // The active account drives the sidebar quota.
  writeUsage(`usage-${extra.id}.json`, 7, 3);
  check('two accounts: the active name over the quota', await page.waitFor(`document.querySelector('[data-quota-account]')?.innerText === 'Principal'`, 70000));
  await openDrawer();
  await page.waitFor(`/7%/.test(${row(extra.id)}?.innerText ?? '')`);
  check('each account shows its own quota', /7%/.test(await page.evaluate(`${row(extra.id)}.innerText`)) && /44%/.test(await page.evaluate(`${row('primary')}.innerText`)));
  check('the extra says it has no login', /Sem sessão iniciada/.test(await page.evaluate(`${row(extra.id)}.innerText`)));
  await page.evaluate(`${row(extra.id)}.querySelector('[role="radio"]').click()`);
  check('choosing it checks its radio', await page.waitFor(`${row(extra.id)}.querySelector('[role="radio"]').getAttribute('aria-checked') === 'true'`));
  check('the API has it as active', (await accounts()).activeAccountId === extra.id);
  check('the sidebar quota follows at once', await page.waitFor(`/7%/.test(${sidebar}) && !/44%/.test(${sidebar})`, 3000), (await page.evaluate(sidebar)).replace(/\n/g, ' | '));
  check('so does the name over it', (await page.evaluate(`document.querySelector('[data-quota-account]')?.innerText`)) === 'Trabalho');

  // Rename.
  await page.evaluate(`[...${row(extra.id)}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Renomear').click()`);
  await page.waitFor(`!!document.querySelector('#account-label')`);
  await page.evaluate(`document.querySelector('#account-label').select()`);
  await page.type('#account-label', 'Cliente (2)');
  await page.waitFor(`document.querySelector('#account-label').value === 'Cliente (2)' && !document.querySelector('[data-account-form] button[type="submit"]').disabled`);
  await page.evaluate(`document.querySelector('[data-account-form] button[type="submit"]').click()`);
  check('renaming updates the row', await page.waitFor(`/Cliente \\(2\\)/.test(${row(extra.id)}.innerText) && !document.querySelector('#account-label')`));
  check('the API has the new name', (await accounts()).accounts.find((a) => a.id === extra.id)?.label === 'Cliente (2)');
  await closeDrawer();
  await openMenu();
  check('the menu item shows the new active name', (await page.evaluate(menuLabels))[0] === 'Conta: Cliente (2)');
  await page.key('Escape', 'Escape', 0, 27);

  // Remove with its terminal running: a real ACCOUNT_004, shown by the handler.
  await openDrawer();
  check('the row counts its running terminal', await page.waitFor(`/1 terminal a correr/.test(${row(extra.id)}.innerText)`));
  await removeThroughConfirm(extra.id);
  check('removing with a running terminal shows the ACCOUNT_004 message', await page.waitFor(`/terminais a correr/.test(${toast})`), await page.evaluate(toast));
  check('the account is still there', (await accounts()).accounts.some((a) => a.id === extra.id));
  const accountDir = join(instance.dataDir, 'accounts', extra.id);
  check('its folder too', existsSync(accountDir));

  // Close the terminal, then remove it: back to the primary, the quota follows.
  const closed = await page.api('DELETE', `/terminals/${loginTerminal.id}`);
  check('the login terminal closes', closed.status < 300, String(closed.status));
  await page.waitFor(`!document.querySelector('.ant-notification-notice')`, 8000);
  await removeThroughConfirm(extra.id);
  check('removing asks and then removes the row', await page.waitFor(`!${row(extra.id)}`));
  view = await accounts();
  check('the API lost it and the active is the primary again', view.accounts.length === 1 && view.activeAccountId === 'primary');
  check('its folder is gone', !existsSync(accountDir));
  check('the sidebar quota is the primary again', await page.waitFor(`/44%/.test(${sidebar})`, 3000));
  await closeDrawer();
  await sleep(200);
  check('one account again: no name over the quota', !(await page.evaluate(`!!document.querySelector('[data-quota-account]')`)));

  // From another page: the page mounts with the state (the original path of focusTerminalId).
  await page.navigate(`${instance.base}/library`);
  await openDrawer();
  await addAccount('Outra');
  check('adding from /library lands on /terminals', await page.waitFor(`location.pathname === '/terminals'`));
  check('with the login banner', await page.waitFor(`/conta Outra/.test(document.querySelector('[data-login-banner]')?.innerText ?? '')`));
  await page.evaluate(clickText('[data-login-banner] button', 'Fechar'));
  check('the banner closes', await page.waitFor(`!document.querySelector('[data-login-banner]')`));

  check('no console errors', page.errors.filter((e) => !/409/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
