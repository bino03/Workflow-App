// An account per terminal (spec contas-do-claude, step 9): the tag, "Noutra conta", "Continuar noutra conta" with the
// context size, and the account picker when resuming. Each action is confirmed on the API. The instance's `claude` has
// no login, so a login is faked by hand (.credentials.json + oauthAccount) and nothing reaches the model; the
// conversations are written by hand too, with the `usage` a real reply carries.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/accounts-terminals.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const PROJECT = instance.projects.Alfa;
const encodeCwd = (path) => path.replace(/[^A-Za-z0-9]/g, '-');
const size = { cols: 80, rows: 24 };

/** A conversation with one real-looking reply: what `contextTokens` reads. */
function writeConversation(sessionId, tokens) {
  const dir = join(instance.claudeDir, 'projects', encodeCwd(PROJECT));
  mkdirSync(dir, { recursive: true });
  const lines = [
    { type: 'user', timestamp: '2026-11-05T10:00:00.000Z', message: { role: 'user', content: `Conversa ${tokens}` } },
    {
      type: 'assistant',
      timestamp: '2026-11-05T10:00:05.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: tokens - 10 } },
    },
  ];
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

/** `accountId` null: the primary, whose folder is the instance's CLAUDE_CONFIG_DIR. */
function fakeLogin(accountId, email) {
  const dir = accountId ? join(instance.dataDir, 'accounts', accountId) : instance.claudeDir;
  writeFileSync(join(dir, '.credentials.json'), '{}');
  const path = join(dir, '.claude.json');
  let json = {};
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // Still without one: the first launch writes it.
  }
  writeFileSync(path, JSON.stringify({ ...json, oauthAccount: { emailAddress: email } }));
}

const terminalsApi = async () => (await page.api('GET', '/terminals')).body;
const accountsApi = async () => (await page.api('GET', '/accounts')).body;
const terminalById = async (id) => (await terminalsApi()).find((t) => t.id === id);
const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const sidebarItem = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const projectSection = `document.querySelector('[data-project=${JSON.stringify(PROJECT).replace(/\\/g, '\\\\')}]')`;
const openMenuItems = `[...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')]`;
// checkVisibility: a closed antd Modal stays in the DOM, hidden, with its last content.
const dialog = `[...document.querySelectorAll('.ant-modal-container')].find((m) => m.checkVisibility() && m.querySelector('[data-context-notice]'))`;
// The filter starts on "a correr" at every load: the pressed chip clears it, or the button when nothing is running.
const allFilter = `([...document.querySelectorAll('.filter-chip')].find((c) => c.getAttribute('aria-pressed') === 'true') ?? [...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Ver todos os projetos'))`;

async function pickFromOpenMenu(label) {
  await page.waitFor(`${openMenuItems}.some((e) => e.textContent.trim().startsWith(${JSON.stringify(label)}))`);
  await page.evaluate(`${openMenuItems}.find((e) => e.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);
  // A menu still closing counts as open: the next pick would land on this one, not on the one it just opened.
  await page.waitFor(`${openMenuItems}.length === 0`);
}

/** Sends Ctrl+C until the terminal's claude exits, over its own WebSocket. */
async function exitTerminal(id) {
  const statusIsExited = `fetch('/api/terminals').then((r) => r.json()).then((l) => l.find((t) => t.id === ${JSON.stringify(id)}).status === 'exited')`;
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
  return page.waitFor(statusIsExited, 25000);
}

/** The process of a terminal, seen from outside the app: proves the arguments it was really launched with. */
function launchedWith(fragment) {
  const filter = `CommandLine like '%${fragment}%' and not CommandLine like '%Get-CimInstance%'`;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "${filter}" | Measure-Object).Count`], { encoding: 'utf8' });
  return Number(out.trim()) > 0;
}

/** The sidebar shows every project, whatever the status filter was. */
async function showAllProjects() {
  await page.waitFor(`!!${allFilter}`);
  await page.evaluate(`${allFilter}.click()`);
  return page.waitFor(`!!${projectSection}`);
}

try {
  check('login', await login(page, instance));

  // One account: nothing of this shows.
  const created = await page.api('POST', '/terminals', { cwd: PROJECT, mode: 'new', ...size });
  check('a terminal in the primary', created.status === 201 && created.body.accountId === 'primary', String(created.status));
  const first = created.body;
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${sidebarItem(first.id)}`);
  check('one account: no tag anywhere', !(await page.evaluate(`!!document.querySelector('[data-account-tag]')`)));
  check('one account: no "other account" arrow', !(await page.evaluate(`!!document.querySelector('button[aria-label$="noutra conta"]')`)));

  // A second account, with no login yet.
  const addedResponse = await page.api('POST', '/accounts', { label: 'Trabalho' });
  check('a second account', addedResponse.status === 201, String(addedResponse.status));
  const extra = addedResponse.body;
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${sidebarItem(first.id)}`);
  await showAllProjects();
  check('the sidebar tag names the account', await page.waitFor(`${sidebarItem(first.id)}?.querySelector('[data-account-tag]')?.innerText === 'Principal'`));
  await page.evaluate(`${sidebarItem(first.id)}.click()`);
  check('so does the pane header', await page.waitFor(`${pane(first.id)}?.querySelector('header [data-account-tag]')?.innerText === 'Principal'`));

  // Without a login it is listed, but cannot be chosen.
  const arrow = `document.querySelector('button[aria-label="Novo terminal em Alfa noutra conta"]')`;
  await page.waitFor(`!!${arrow}`);
  await page.evaluate(`${arrow}.click()`);
  check('the menu names the account without a login', await page.waitFor(`${openMenuItems}.some((e) => /Trabalho · sem sessão iniciada/.test(e.textContent))`));
  check('and disables it', await page.evaluate(`${openMenuItems}.find((e) => /Trabalho/.test(e.textContent)).getAttribute('aria-disabled') === 'true'`));
  const before = (await terminalsApi()).length;
  await page.evaluate(`${openMenuItems}.find((e) => /Trabalho/.test(e.textContent)).click()`);
  await page.key('Escape', 'Escape', 0, 27);
  check('clicking it opens nothing', (await terminalsApi()).length === before);

  // With a login, reopening the menu is enough: it rereads the accounts, with no wait for the 60 s poll.
  fakeLogin(extra.id, 'trabalho@example.com');
  await page.waitFor(`!${openMenuItems}.length`, 2000);
  await page.evaluate(`${arrow}.click()`);
  check('after the login the menu has it enabled at once', await page.waitFor(`${openMenuItems}.some((e) => e.textContent.trim() === 'Trabalho' && e.getAttribute('aria-disabled') !== 'true')`, 5000));

  // "Noutra conta" on the project of the sidebar.
  await pickFromOpenMenu('Trabalho');
  check(
    '"Noutra conta" creates exactly one terminal in that account',
    await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.filter((t) => t.accountId === ${JSON.stringify(extra.id)}).length === 1)`),
  );
  const list = await terminalsApi();
  const inExtra = list.find((t) => t.accountId === extra.id);
  check('the API has one more terminal, not two', list.length === before + 1, String(list.length));
  check('its tag shows the other account', await page.waitFor(`${sidebarItem(inExtra.id)}?.querySelector('[data-account-tag]')?.innerText === 'Trabalho'`));
  check('the active account did not change', (await accountsApi()).activeAccountId === 'primary');

  // "Noutra conta" on an empty project: the click must not also activate the project header, which creates a terminal.
  const empty = instance.projects.Beta;
  const emptySection = `document.querySelector('[data-project=${JSON.stringify(empty).replace(/\\/g, '\\\\')}]')`;
  await page.waitFor(`!!${emptySection}`);
  await page.evaluate(`${emptySection}.querySelector('button[aria-label$="noutra conta"]').click()`);
  await pickFromOpenMenu('Trabalho');
  check(
    'on an empty project: one terminal, in that account',
    await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.filter((t) => t.cwd === ${JSON.stringify(empty)}).length === 1)`),
  );
  await new Promise((r) => setTimeout(r, 1000));
  const inEmpty = (await terminalsApi()).filter((t) => t.cwd === empty);
  check('still one a moment later, and no primary one', inEmpty.length === 1 && inEmpty[0].accountId === extra.id, inEmpty.map((t) => t.accountId).join(','));

  // "Continuar noutra conta" on an exited terminal, with a big conversation. No route ends a process, so Ctrl+C does.
  writeConversation(first.claudeSessionId, 120_000);
  await page.evaluate(`${sidebarItem(first.id)}.click()`);
  check('the terminal exits', await exitTerminal(first.id));
  await page.evaluate(`${sidebarItem(first.id)}.click()`);
  check('the pane offers "Continuar noutra conta"', await page.waitFor(`!!${pane(first.id)}?.querySelector('[data-continue-elsewhere]')`));
  await page.evaluate(`${pane(first.id)}.querySelector('[data-continue-elsewhere]').click()`);
  await pickFromOpenMenu('Trabalho');
  check('it asks first, with the size', await page.waitFor(`/~120 mil tokens vão contar na quota de Trabalho/.test(${dialog}?.innerText ?? '')`));
  check('over 50 thousand: highlighted, with /compact', await page.evaluate(`!!${dialog}.querySelector('[data-context-notice="high"]') && /\\/compact/.test(${dialog}.innerText)`));
  check('nothing changed yet', (await terminalById(first.id)).accountId === 'primary');
  await page.evaluate(`[...${dialog}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancelar').click()`);
  await page.waitFor(`!${dialog}`, 3000);
  check('Cancelar leaves it in the primary', (await terminalById(first.id)).accountId === 'primary');

  await page.evaluate(`${pane(first.id)}.querySelector('[data-continue-elsewhere]').click()`);
  await pickFromOpenMenu('Trabalho');
  await page.waitFor(`!!${dialog}`);
  await page.evaluate(`[...${dialog}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Continuar nesta conta').click()`);
  check('it reopens in the other account', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => { const t = l.find((x) => x.id === ${JSON.stringify(first.id)}); return t.status === 'running' && t.accountId === ${JSON.stringify(extra.id)}; })`));
  check('with --resume: the process has the same conversation', launchedWith(`--resume ${first.claudeSessionId}`));
  check('no "conversa nova" toast', !/Conversa nova/.test(await page.evaluate(`document.querySelector('.ant-notification')?.innerText ?? ''`)));
  check('the session id did not change', (await terminalById(first.id)).claudeSessionId === first.claudeSessionId);
  check('the tag followed', await page.waitFor(`${sidebarItem(first.id)}?.querySelector('[data-account-tag]')?.innerText === 'Trabalho'`));

  // Resume: an account picker, and the notice only when the account changes.
  const small = '33333333-3333-4333-8333-333333333333';
  writeConversation(small, 8_000);
  const history = `document.querySelector('[data-project=${JSON.stringify(PROJECT).replace(/\\/g, '\\\\')}] button[aria-label^="Retomar"]')`;
  await page.evaluate(`${history}.click()`);
  const option = (id) => `document.querySelector('[data-session-id="${id}"]')`;
  check('the resume modal lists the conversation', await page.waitFor(`!!${option(small)}`));
  check('the account picker starts on the active one', await page.waitFor(`/Principal/.test(document.querySelector('.ant-modal-container .ant-select')?.innerText ?? '')`));
  await page.evaluate(`${option(small)}.click()`);
  await page.waitFor(`${option(small)}.getAttribute('aria-selected') === 'true'`);
  const notices = `[...document.querySelectorAll('.ant-modal-container [data-context-notice]')].filter((n) => n.checkVisibility()).map((n) => n.innerText).join(' | ')`;
  check('same account: no notice', (await page.evaluate(notices)) === '', await page.evaluate(notices));

  await page.evaluate(`document.querySelector('.ant-modal-container .ant-select').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  const selectOption = (label) => `[...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')].find((e) => e.textContent.trim() === ${JSON.stringify(label)})`;
  await page.waitFor(`!!${selectOption('Trabalho')}`);
  await page.evaluate(`${selectOption('Trabalho')}.click()`);
  check('another account: the notice, not highlighted under 50 thousand', await page.waitFor(`document.querySelector('.ant-modal-container [data-context-notice="normal"]')?.innerText.includes('~8 mil tokens vão contar na quota de Trabalho') === true`));

  await page.evaluate(`[...document.querySelectorAll('.ant-modal-footer button')].find((b) => b.textContent.trim() === 'Retomar sessão').click()`);
  check(
    'it resumes in the chosen account',
    await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.some((t) => t.claudeSessionId === ${JSON.stringify(small)} && t.accountId === ${JSON.stringify(extra.id)}))`),
  );

  const consoleErrors = page.errors.length;
  check('no console errors', consoleErrors === 0, page.errors.join(' | '));

  // A stopped terminal (the backend restarted), with no conversation yet: no context to resend, and it starts afresh.
  fakeLogin(null, 'principal@example.com');
  const verify = import.meta.dirname;
  execFileSync(process.execPath, [join(verify, 'instance.mjs'), 'stop', '--dir', instance.runDir], { stdio: 'ignore' });
  execFileSync(process.execPath, [join(verify, 'instance.mjs'), 'start', '--dir', instance.runDir], { stdio: 'ignore' });
  check('login again, after the restart', await login(page, readInstance(instance.runDir)));
  await showAllProjects();
  const stopped = inEmpty[0].id;
  await page.waitFor(`!!${sidebarItem(stopped)}`);
  await page.evaluate(`${sidebarItem(stopped)}.click()`);
  check('the terminal is stopped and kept its account', await page.waitFor(`/Parado/.test(${sidebarItem(stopped)}?.innerText ?? '') && ${sidebarItem(stopped)}.querySelector('[data-account-tag]')?.innerText === 'Trabalho'`));
  check('the stopped pane offers it next to Reabrir', await page.waitFor(`!!${pane(stopped)}?.querySelector('[data-continue-elsewhere]')`));
  await page.evaluate(`${pane(stopped)}.querySelector('[data-continue-elsewhere]').click()`);
  await pickFromOpenMenu('Principal');
  check('with no replies yet it says there is nothing to resend', await page.waitFor(`!!${dialog}?.querySelector('[data-context-notice="empty"]')`));
  await page.evaluate(`[...${dialog}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Continuar nesta conta').click()`);
  check('it reopens in the primary', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => { const t = l.find((x) => x.id === ${JSON.stringify(stopped)}); return t.status === 'running' && t.accountId === 'primary'; })`));
  check('and says it started a new conversation', await page.waitFor(`/Conversa nova/.test(document.querySelector('.ant-notification')?.innerText ?? '')`));
  check('no console errors after the restart', page.errors.slice(consoleErrors).filter((e) => !/401/.test(e)).length === 0, page.errors.slice(consoleErrors).join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
