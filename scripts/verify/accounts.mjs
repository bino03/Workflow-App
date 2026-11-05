// The "Escolher conta" drawer (spec contas-do-claude, step 8): the header menu item, adding an account and doing its
// login in a window over the page (never a project tab), the sidebar quota following the active account, renaming, and
// removing with and without a running terminal. Each action is confirmed on the API, not only on screen. The instance's
// `claude` has no login, so the quota files and the login are written by hand.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/accounts.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

  // Add: a window over the page. A login is not a project, so no tab, no sidebar entry, no navigation.
  const tabsBefore = await page.evaluate(`document.querySelectorAll('[role="tab"]').length`);
  await addAccount('Trabalho');
  check('adding opens the login window with the drawer closed', await page.waitFor(`!(${drawerOpen}) && !!document.querySelector('[data-account-login] [data-terminal-id]')`));
  check('the terminal has the keyboard', await page.waitFor(`!!document.activeElement?.closest('[data-account-login] .xterm')`), await page.evaluate(`document.activeElement?.className ?? ''`));
  check('its title names the account', /Trabalho/.test(await page.evaluate(`document.querySelector('[data-account-login]').closest('.ant-modal-container').innerText`)));
  check('the page stays where it was', (await page.evaluate(`location.pathname`)) === '/terminals');
  check('no new project tab', (await page.evaluate(`document.querySelectorAll('[role="tab"]').length`)) === tabsBefore);
  let view = await accounts();
  const extra = view.accounts.find((a) => a.label === 'Trabalho');
  check('the account exists, with no login, and is not active', extra && !extra.loggedIn && view.activeAccountId === 'primary');
  check('its terminal is not in the terminals list', (await page.api('GET', '/terminals')).body.length === 0);
  const loginTerminalId = await page.evaluate(`document.querySelector('[data-account-login] [data-terminal-id]').dataset.terminalId`);
  check('but it exists', (await page.api('GET', `/terminals/${loginTerminalId}/context`)).status === 200);
  const loginFooter = `document.querySelector('[data-account-login]').closest('.ant-modal-container').querySelector('.ant-modal-footer')`;
  const loginButton = (label) => `[...${loginFooter}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
  check('Concluir waits for the login', await page.evaluate(`${loginButton('Concluir')}.disabled`));
  check('Esc belongs to the terminal: the window stays', await (async () => {
    await page.key('Escape', 'Escape', 0, 27);
    await sleep(400);
    return page.evaluate(`!!document.querySelector('[data-account-login]')?.checkVisibility()`);
  })());

  // Cancelar asks first; the terminal ends and the account stays, ready for "Iniciar sessão".
  await page.evaluate(`${loginButton('Cancelar')}.click()`);
  const confirmButton = (label) => `[...document.querySelectorAll('.ant-modal-container button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)} && b.checkVisibility())`;
  check('Cancelar asks first', await page.waitFor(`!!${confirmButton('Fechar')}`));
  const hit = await page.evaluate(`(() => { const b = ${confirmButton('Fechar')}.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!e?.closest('button')?.textContent.includes('Fechar'); })()`);
  check('the question is on top of the window', hit);
  await page.evaluate(`${confirmButton('Fechar')}.click()`);
  check('the window closes', await page.waitFor(`!document.querySelector('[data-account-login]')?.checkVisibility()`));
  check('its terminal is gone', await page.waitFor(`fetch('/api/terminals/${loginTerminalId}/context').then((r) => r.status === 404)`));
  check('the account stays', (await accounts()).accounts.some((a) => a.id === extra?.id));

  // "Iniciar sessão" again, from the row: when the login lands, the window wakes up by itself.
  await openDrawer();
  await page.waitFor(`!!${row(extra.id)}`);
  await page.evaluate(`[...${row(extra.id)}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Iniciar sessão').click()`);
  check('"Iniciar sessão" opens the window again', await page.waitFor(`!!document.querySelector('[data-account-login] [data-terminal-id]')`));
  const accountDirForLogin = join(instance.dataDir, 'accounts', extra.id);
  writeFileSync(join(accountDirForLogin, '.credentials.json'), '{}');
  await page.waitFor(`document.querySelector('[data-login-status]')?.dataset.loginStatus === 'waiting'`);
  const claudeJson = join(accountDirForLogin, '.claude.json');
  const current = existsSync(claudeJson) ? JSON.parse(readFileSync(claudeJson, 'utf8')) : {};
  writeFileSync(claudeJson, JSON.stringify({ ...current, oauthAccount: { emailAddress: 'trabalho@example.com' } }));
  check('the window sees the login by itself', await page.waitFor(`document.querySelector('[data-login-status]')?.dataset.loginStatus === 'done' && /trabalho@example.com/.test(document.querySelector('[data-login-status]').innerText)`, 8000));
  await page.evaluate(`${loginButton('Concluir')}.click()`);
  check('Concluir closes it', await page.waitFor(`!document.querySelector('[data-account-login]')?.checkVisibility()`));
  check('and says the account is ready', await page.waitFor(`/Conta pronta/.test(${toast})`));
  await page.waitFor(`!document.querySelector('.ant-notification-notice')`, 8000);

  // A real terminal of that account, for the removal below.
  const created = await page.api('POST', '/terminals', { cwd: instance.projects.Alfa, mode: 'new', accountId: extra.id, cols: 80, rows: 24 });
  const loginTerminal = created.body;
  check('a terminal in that account', created.status === 201 && loginTerminal.accountId === extra.id, String(created.status));

  // The active account drives the sidebar quota.
  writeUsage(`usage-${extra.id}.json`, 7, 3);
  check('two accounts: the active name over the quota', await page.waitFor(`document.querySelector('[data-quota-account]')?.innerText === 'Principal'`, 70000));
  await openDrawer();
  await page.waitFor(`/7%/.test(${row(extra.id)}?.innerText ?? '')`);
  check('each account shows its own quota', /7%/.test(await page.evaluate(`${row(extra.id)}.innerText`)) && /44%/.test(await page.evaluate(`${row('primary')}.innerText`)));
  check('the extra shows its email', /trabalho@example.com/.test(await page.evaluate(`${row(extra.id)}.innerText`)));
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

  // From another page: the window opens there, and a reload leaves the login terminal behind. It must not block removing.
  await page.navigate(`${instance.base}/library`);
  await openDrawer();
  await addAccount('Outra');
  check('adding from /library opens the window there', await page.waitFor(`!!document.querySelector('[data-account-login] [data-terminal-id]') && location.pathname === '/library'`));
  await page.navigate(`${instance.base}/library`);
  await openDrawer();
  const outra = (await accounts()).accounts.find((a) => a.label === 'Outra');
  await page.waitFor(`!!${row(outra.id)}`);
  check('a login left behind does not count as a running terminal', /0 terminais a correr/.test(await page.evaluate(`${row(outra.id)}.innerText`)));
  await removeThroughConfirm(outra.id);
  check('nor does it block removing the account', await page.waitFor(`!${row(outra.id)}`));
  check('whose folder is gone', !existsSync(join(instance.dataDir, 'accounts', outra.id)));

  check('no console errors', page.errors.filter((e) => !/409/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
