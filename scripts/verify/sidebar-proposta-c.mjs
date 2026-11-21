// What was missing from the canvas proposta C (ADR 0036), found by the owner on 2026-11-21: the quota in the title
// bar (not in the sidebar), "+ Novo terminal" at the bottom of the sidebar, dense terminal rows in collapsible
// groups, BRANCHES (read from .git, view only) and SESSÕES GRAVADAS (5 newest, click resumes), the status bar
// ("Teclado em <terminal>" + shortcut hints) and "Abrir outra pasta…" in the project switcher.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh --sessions
//   node scripts/verify/sidebar-proposta-c.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, openProject, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const BETA = instance.projects.Beta;
const GAMA = instance.projects.Gama;
const HASH = '0123456789abcdef0123456789abcdef01234567';
const text = (expression) => page.evaluate(`(${expression})?.innerText ?? ''`);
const group = (id) => `document.querySelector('[data-sidebar-group="${id}"]')`;
const terminalItems = `[...document.querySelectorAll('[data-terminal-item]')]`;

// Alfa is a repository with three branches, on feat/ws-auth.
const git = join(ALFA, '.git');
mkdirSync(join(git, 'refs', 'heads', 'feat'), { recursive: true });
writeFileSync(join(git, 'HEAD'), 'ref: refs/heads/feat/ws-auth\n');
for (const name of ['main', 'feat/ws-auth']) writeFileSync(join(git, 'refs', 'heads', ...name.split('/')), `${HASH}\n`);
writeFileSync(join(git, 'packed-refs'), `${HASH} refs/heads/feat/ide-shell\n`);

// The quota, as the status line would leave it: 42% (resets in 2 h) and 81% weekly.
const inHours = (hours) => Math.floor(Date.now() / 1000 + hours * 3600);
writeFileSync(
  join(instance.dataDir, 'usage.json'),
  JSON.stringify({
    rate_limits: { five_hour: { used_percentage: 42, resets_at: inHours(2) }, seven_day: { used_percentage: 81, resets_at: inHours(72) } },
    fetchedAt: new Date().toISOString(),
  }),
);

try {
  check('login', await login(page, instance));
  await page.navigate(`${instance.base}/terminals`);

  // Title bar quota, compact; none in the sidebar.
  check('quota in the title bar', await page.waitFor(`/5h 42%/.test(document.querySelector('[data-quota="titlebar"]')?.innerText ?? '')`, 8000), await text(`document.querySelector('[data-quota="titlebar"]')`));
  const quota = await text(`document.querySelector('[data-quota="titlebar"]')`);
  check('weekly 81% in amber', /sem 81%/.test(quota) && (await page.evaluate(`[...document.querySelectorAll('[data-quota="titlebar"] .text-warning')].some((s) => s.textContent === '81%')`)), quota);
  check('reset time shown (↻)', /↻\d{2}:\d{2}/.test(quota), quota);
  check('quota sits right before the user menu', await page.evaluate(`document.querySelector('[data-quota="titlebar"]').nextElementSibling?.getAttribute('aria-label') === 'Menu de utilizador'`));
  check('no quota in the sidebar any more', !(await page.evaluate(`!!document.querySelector('aside [data-quota]')`)));

  // Alfa: branches, Novo terminal at the bottom, dense row.
  check('Alfa active', await openProject(page, ALFA));
  check('BRANCHES group', await page.waitFor(`!!${group('branches')}`, 5000));
  const branches = await page.evaluate(`[...${group('branches')}.querySelectorAll('[data-branch]')].map((b) => b.dataset.branch)`);
  check('branches: current first, then by name', JSON.stringify(branches) === JSON.stringify(['feat/ws-auth', 'feat/ide-shell', 'main']), JSON.stringify(branches));
  check('current branch marked', await page.evaluate(`${group('branches')}.querySelector('[data-branch="feat/ws-auth"]').getAttribute('aria-current') === 'true'`));
  check('API agrees', await page.api('GET', `/branches?path=${encodeURIComponent(ALFA)}`).then((r) => r.status === 200 && r.body.current === 'feat/ws-auth'));

  const button = `document.querySelector('aside [data-new-terminal]')`;
  check('"Novo terminal" at the bottom of the sidebar', await page.evaluate(`!!${button} && ${button}.textContent.includes('Novo terminal')`));
  await page.evaluate(`${button}.click()`);
  check('it opens a terminal', await page.waitFor(`${terminalItems}.length === 1`, 10000));
  const row = await page.evaluate(`(() => { const r = ${terminalItems}[0]; return { h: r.getBoundingClientRect().height, text: r.innerText }; })()`);
  check('terminal row is one line of 26 px', Math.round(row.h) === 26, JSON.stringify(row));
  check('row meta is pane-1', /pane-1/.test(row.text), row.text);

  // Collapsing a group hides its rows.
  await page.evaluate(`${group('terminals')}.querySelector('button[aria-expanded]').click()`);
  check('TERMINAIS collapses', await page.waitFor(`${terminalItems}.length === 0`, 2000));
  await page.evaluate(`${group('terminals')}.querySelector('button[aria-expanded]').click()`);
  check('and opens again', await page.waitFor(`${terminalItems}.length === 1`, 2000));

  // Status bar: the terminal with the keyboard and the shortcut hints.
  check('status bar: Teclado em <terminal>', await page.waitFor(`/Teclado em/.test(document.querySelector('[data-status-keyboard]')?.innerText ?? '')`, 3000), await text(`document.querySelector('footer')`));
  const footer = await text(`document.querySelector('footer')`);
  check('status bar hints from the catalogue', /Alt\+N novo/.test(footer) && /Alt\+B projeto/.test(footer) && /Alt\+K tarefas/.test(footer), footer);
  check('version still at the end', /v\d/.test(footer));

  // Beta: saved sessions, click resumes, it leaves the group.
  check('Beta active', await openProject(page, BETA));
  check('SESSÕES GRAVADAS group', await page.waitFor(`!!${group('sessions')} && ${group('sessions')}.querySelectorAll('[data-saved-session]').length === 2`, 5000));
  const sessionText = await text(group('sessions'));
  check('titles and a date', /Sessao de teste A/.test(sessionText) && /\d{1,2} out|ontem|\d{2}:\d{2}/.test(sessionText), sessionText.replace(/\n/g, ' | '));
  check('no branches outside a repository', !(await page.evaluate(`!!${group('branches')}`)));
  await page.evaluate(`document.querySelector('[data-saved-session="11111111-1111-4111-8111-111111111111"]').click()`);
  check('click resumes it in a terminal', await page.waitFor(`${terminalItems}.length === 1`, 10000));
  const resumed = await page.api('GET', '/terminals');
  check('API: the terminal resumes that session', resumed.body.some((t) => t.claudeSessionId === '11111111-1111-4111-8111-111111111111'), JSON.stringify(resumed.body.map((t) => t.claudeSessionId)));
  check('it leaves the group (open in a terminal)', await page.waitFor(`${group('sessions')}?.querySelectorAll('[data-saved-session]').length === 1`, 5000));

  // Switcher: "Abrir outra pasta…" → browse → Novo terminal aqui.
  await page.evaluate(`document.querySelector('button[data-project-switcher]').click()`);
  await page.waitFor(`!!document.querySelector('[data-switcher-open-folder]')`, 3000);
  await page.evaluate(`document.querySelector('[data-switcher-open-folder]').click()`);
  check('the folder modal opens', await page.waitFor(`!!document.querySelector('[data-open-folder]')`, 3000));
  await page.waitFor(`document.querySelectorAll('[data-folder-row]').length > 0`, 5000);
  const root = instance.rootsDir;
  const rootRow = `[...document.querySelectorAll('[data-folder-row]')].find((r) => r.dataset.folderRow.toLowerCase() === ${JSON.stringify(root.toLowerCase())})`;
  check('the roots are listed', await page.evaluate(`!!${rootRow}`), await page.evaluate(`[...document.querySelectorAll('[data-folder-row]')].map((r) => r.dataset.folderRow).join(' ; ')`));
  await page.evaluate(`${rootRow}.click()`);
  const gamaRow = `[...document.querySelectorAll('[data-folder-row]')].find((r) => r.dataset.folderRow.toLowerCase() === ${JSON.stringify(GAMA.toLowerCase())})`;
  check('browse into the root', await page.waitFor(`!!${gamaRow}`, 5000));
  await page.evaluate(`${gamaRow}.click()`);
  await page.waitFor(`(document.querySelector('[data-open-folder-current]')?.dataset.openFolderCurrent ?? '').toLowerCase() === ${JSON.stringify(GAMA.toLowerCase())} && !document.querySelector('[data-open-folder-confirm]').disabled`, 5000);
  await page.evaluate(`document.querySelector('[data-open-folder-confirm]').click()`);
  check('a terminal opens in that folder', await page.waitFor(`(document.querySelector('aside[data-project]')?.dataset.project ?? '').toLowerCase() === ${JSON.stringify(GAMA.toLowerCase())} && ${terminalItems}.length === 1`, 10000), await page.evaluate(`JSON.stringify({ project: document.querySelector('aside[data-project]')?.dataset.project, items: ${terminalItems}.length, modal: !!document.querySelector('[data-open-folder]'), gama: ${JSON.stringify(GAMA)} })`));
  check('the modal closed', !(await page.evaluate(`!!document.querySelector('[data-open-folder]')`)));

  check('no console errors', page.errors.filter((e) => !/40[349]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
