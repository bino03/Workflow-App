// Tasks per project (ADR 0037): the "☑ open/total" button in the sidebar and Alt+K open the 300 px panel on the
// right; add (Enter, newest last), mark done, filters, delete with "Desfazer" (back with the same id and place),
// per project, open/closed kept in localStorage. Confirmed on the API and the DOM.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-tasks.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, openProject, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const BETA = instance.projects.Beta;
const panel = `document.querySelector('[data-tasks-panel]')`;
const toggle = `document.querySelector('[data-tasks-toggle]')`;
const input = '[data-tasks-panel] input[aria-label="Nova tarefa"]';
const rows = `[...document.querySelectorAll('[data-tasks-panel] [data-task]')]`;
const texts = () => page.evaluate(`${rows}.map((r) => r.querySelector('[data-task-text]').textContent)`);
const list = async (path) => (await page.api('GET', `/project-tasks?${new URLSearchParams({ projectPath: path })}`)).body;
const chip = (label) => `[...document.querySelectorAll('[data-tasks-panel] .filter-chip')].find((b) => b.textContent.startsWith(${JSON.stringify(label)}))`;
const addTask = async (text) => {
  await page.type(input, text);
  await page.key('Enter', 'Enter', 0, 13);
};

try {
  check('login', await login(page, instance));
  await page.evaluate(`localStorage.removeItem('workflow-app.tasks-panel-open')`);
  await page.navigate(`${instance.base}/terminals`);
  check('Alfa active', await openProject(page, ALFA));
  const alfaPath = await page.evaluate(`document.querySelector('aside[data-project]').dataset.project`);

  // HTTP: the real routes, with the page's session.
  const created = await page.api('POST', '/project-tasks', { projectPath: alfaPath, text: 'pela API' });
  check('POST → 201', created.status === 201, JSON.stringify(created));
  const removedApi = await page.api('DELETE', `/project-tasks/${created.body.id}`);
  check('DELETE → 200 with the task', removedApi.status === 200 && removedApi.body.id === created.body.id);
  check('GET empty again', (await list(alfaPath)).length === 0);
  const outside = await page.api('POST', '/project-tasks', { projectPath: 'C:\\Windows', text: 'x' });
  check('outside ALLOWED_ROOTS → FOLDER_001', outside.status === 403 && outside.body.errorCode === 'FOLDER_001', JSON.stringify(outside));

  check('panel closed by default', !(await page.evaluate(`!!${panel}`)));
  check('button shows 0/0', (await page.evaluate(`${toggle}.textContent`)) === '0/0');

  await page.evaluate(`${toggle}.click()`);
  check('button opens the panel', await page.waitFor(`!!${panel}`, 3000));
  const width = await page.evaluate(`${panel}.getBoundingClientRect().width`);
  check('panel is 300 px', Math.round(width) === 300, String(width));
  check('input focused on open', await page.waitFor(`document.activeElement === document.querySelector(${JSON.stringify(input)})`, 2000));
  check('localStorage open = 1', (await page.evaluate(`localStorage.getItem('workflow-app.tasks-panel-open')`)) === '1');

  await addTask('primeira');
  await page.waitFor(`${rows}.length === 1`, 3000);
  await addTask('segunda');
  await page.waitFor(`${rows}.length === 2`, 3000);
  await addTask('terceira');
  await page.waitFor(`${rows}.length === 3`, 3000);
  check('newest last', JSON.stringify(await texts()) === JSON.stringify(['primeira', 'segunda', 'terceira']), JSON.stringify(await texts()));
  check('input emptied', (await page.evaluate(`document.querySelector(${JSON.stringify(input)}).value`)) === '');
  check('API agrees (3, in order)', (await list(alfaPath)).map((t) => t.text).join() === 'primeira,segunda,terceira');
  check('button shows 3/3', await page.waitFor(`${toggle}.textContent === '3/3'`, 2000), await page.evaluate(`${toggle}.textContent`));

  // Mark the first as done → leaves "Por fazer", appears in "Feitas".
  await page.evaluate(`${rows}[0].querySelector('input[type=checkbox]').click()`);
  await page.waitFor(`${rows}.length === 2`, 3000);
  check('done leaves "Por fazer"', JSON.stringify(await texts()) === JSON.stringify(['segunda', 'terceira']));
  check('button shows 2/3', await page.waitFor(`${toggle}.textContent === '2/3'`, 2000));
  const doneApi = (await list(alfaPath)).find((t) => t.text === 'primeira');
  check('API: done with doneAt', doneApi.done === true && typeof doneApi.doneAt === 'string');
  await page.evaluate(`${chip('Feitas')}.click()`);
  await page.waitFor(`${rows}.length === 1`, 2000);
  check('"Feitas" shows it, struck through', await page.evaluate(`${rows}[0].querySelector('[data-task-text]').classList.contains('line-through')`));
  await page.evaluate(`${chip('Todas')}.click()`);
  await page.waitFor(`${rows}.length === 3`, 2000);
  check('"Todas" keeps the place', JSON.stringify(await texts()) === JSON.stringify(['primeira', 'segunda', 'terceira']));

  // Delete the middle one: no dialog, "Desfazer" brings it back in place with the same id.
  const before = await list(alfaPath);
  const middle = before.find((t) => t.text === 'segunda');
  await page.evaluate(`${rows}[1].querySelector('button[aria-label^="Apagar"]').click()`);
  await page.waitFor(`${rows}.length === 2`, 3000);
  check('no confirmation dialog', !(await page.evaluate(`!!document.querySelector('.ant-modal-container')`)));
  check('"Tarefa apagada · Desfazer" shown', await page.waitFor(`[...document.querySelectorAll('[data-tasks-panel] [role=status] button')].some((b) => b.textContent === 'Desfazer')`, 2000));
  check('API: really deleted', (await list(alfaPath)).length === 2);
  await page.evaluate(`[...document.querySelectorAll('[data-tasks-panel] [role=status] button')].find((b) => b.textContent === 'Desfazer').click()`);
  await page.waitFor(`${rows}.length === 3`, 3000);
  check('back in its place', JSON.stringify(await texts()) === JSON.stringify(['primeira', 'segunda', 'terceira']), JSON.stringify(await texts()));
  const after = await list(alfaPath);
  check('same id and createdAt', after[1].id === middle.id && after[1].createdAt === middle.createdAt);

  // The undo bar goes away by itself.
  await page.evaluate(`${rows}[2].querySelector('button[aria-label^="Apagar"]').click()`);
  await page.waitFor(`!!document.querySelector('[data-tasks-panel] [role=status]')`, 2000);
  await sleep(6500);
  check('undo bar gone after ~6 s', !(await page.evaluate(`!!document.querySelector('[data-tasks-panel] [role=status]')`)));
  check('deletion stays', (await list(alfaPath)).length === 2);

  // Per project: Beta has its own (empty) list; the panel stays open and does not steal the focus.
  check('Beta active', await openProject(page, BETA));
  check('panel still open on Beta', await page.waitFor(`!!${panel}`, 3000));
  check('Beta list empty', await page.waitFor(`${rows}.length === 0 && ${toggle}.textContent === '0/0'`, 3000));
  check('switching project does not focus the input', !(await page.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(input)})`)));
  check('Alfa back: its tasks', (await openProject(page, ALFA)) && (await page.waitFor(`${toggle}.textContent === '1/2'`, 3000)), await page.evaluate(`${toggle}.textContent`));

  // Alt+K closes and opens; the state survives a reload.
  await page.evaluate(`document.body.focus()`);
  await page.key('KeyK', 'k', 1);
  check('Alt+K closes', await page.waitFor(`!${panel}`, 2000));
  check('localStorage open = 0', (await page.evaluate(`localStorage.getItem('workflow-app.tasks-panel-open')`)) === '0');
  await page.key('KeyK', 'k', 1);
  check('Alt+K opens', await page.waitFor(`!!${panel}`, 2000));
  await page.navigate(`${instance.base}/terminals`);
  // Without terminals no project is active after a reload (and no project = no panel): pick Alfa again.
  check('open after reload', (await openProject(page, ALFA)) && (await page.waitFor(`!!${panel}`, 5000)));
  check('reload does not focus the input', !(await page.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(input)})`)));
  check('close button closes', (await page.evaluate(`document.querySelector('[aria-label="Fechar tarefas"]').click(), true`)) && (await page.waitFor(`!${panel}`, 2000)));

  check('keybindings list toggleTasks = Alt+K', await page.api('GET', '/keybindings').then((r) => r.body.actions.some((a) => a.id === 'toggleTasks' && a.binding?.code === 'KeyK')));
  check('no console errors', page.errors.filter((e) => !/40[349]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
