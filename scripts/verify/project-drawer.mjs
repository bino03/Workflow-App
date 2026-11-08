// The project sheet drawer (spec informacao-dos-projetos, step 5): "Adicionar informação" opens it in edit mode,
// the form validates (a javascript: URL is refused), Guardar writes through the API and the card updates without a
// reload, Editar keeps the environment ids, 5 environments at most, Cancelar discards, Apagar ficha removes it, and
// a project pre-opened through location.state. Every claim on screen is also read back from the API.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-drawer.mjs [run dir] [screenshot path]
//   node scripts/verify/instance.mjs stop --clean
import { writeFileSync } from 'node:fs';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2] || undefined);
const screenshotPath = process.argv[3];
const { check, finish } = checker();
const page = await openBrowser();

const gama = instance.projects.Gama;
const cards = `[...document.querySelectorAll('article[aria-label]')]`;
const card = (name) => `${cards}.find((c) => c.getAttribute('aria-label') === ${JSON.stringify(name)})`;
const drawerOpen = `!!document.querySelector('.ant-drawer-open')`;
const drawerText = `(document.querySelector('.ant-drawer-open')?.textContent ?? '')`;
const sheets = async () => (await page.api('GET', '/project-infos')).body;
const gamaSheet = async () => (await sheets()).find((s) => s.projectPath === gama);
const footerButton = (label) => `[...document.querySelectorAll('.ant-drawer-open .ant-drawer-footer button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const clickFooter = (label) => page.evaluate(`${footerButton(label)}.click()`);
const buttonDisabled = (label) => page.evaluate(`${footerButton(label)}?.disabled ?? null`);

/** Replaces the content of a field like a user: focus, select everything, type over it. */
async function fill(selector, text) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
  await page.send('Input.insertText', { text });
}

/** Picks an option of an antd Select (opened by a mousedown on its root). */
async function choose(selectId, optionTitle) {
  await page.evaluate(`document.querySelector('#${selectId}').closest('.ant-select').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  const found = await page.waitFor(`!![...document.querySelectorAll('.ant-select-item-option')].find((o) => o.getAttribute('title') === ${JSON.stringify(optionTitle)})`);
  if (!found) throw new Error(`option ${optionTitle} not offered`);
  await page.evaluate(`[...document.querySelectorAll('.ant-select-item-option')].find((o) => o.getAttribute('title') === ${JSON.stringify(optionTitle)}).click()`);
}

try {
  check('login', await login(page, instance));
  await page.navigate(`${instance.base}/projects`);
  check('3 cards', await page.waitFor(`${cards}.length === 3`));

  // "Adicionar informação" → the drawer opens already in edit mode.
  check('a project without a sheet offers "Adicionar informação"', await page.evaluate(`!![...${card('Gama')}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Adicionar informação')`));
  await page.evaluate(`[...${card('Gama')}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Adicionar informação').click()`);
  check('the drawer opens in edit mode', await page.waitFor(`!!document.querySelector('.ant-drawer-open #pi-client')`));
  check('the drawer is titled with the project', await page.evaluate(`${drawerText}.includes('Gama')`));
  check('Guardar is disabled while nothing changed', (await buttonDisabled('Guardar')) === true);
  check('the notes warn about secrets', await page.evaluate(`${drawerText}.includes('Não guardes passwords nem tokens aqui.')`));

  await choose('pi-lifecycle', 'Em produção');
  await fill('#pi-client', 'ACME');
  await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open button')].find((b) => b.textContent.trim() === 'Adicionar ambiente').click()`);
  check('"Adicionar ambiente" adds a production environment named "Produção"', await page.waitFor(`document.querySelector('#pi-env-0-name')?.value === 'Produção'`));

  // Validation: a javascript: URL is refused in the field and Guardar stays disabled.
  await fill('#pi-env-0-url', 'javascript:alert(1)');
  check('a javascript: URL shows the field error', await page.waitFor(`document.querySelector('#pi-env-0-url-error')?.textContent.includes('http://')`));
  check('and Guardar is disabled', await page.waitFor(`${footerButton('Guardar')}?.disabled === true`));
  await fill('#pi-env-0-url', 'https://gama.example.com');
  check('a valid URL clears the error', await page.waitFor(`document.querySelector('#pi-env-0-url-error')?.textContent === ''`));
  await fill('#pi-env-0-hosting', 'Vercel');
  await fill('#pi-env-0-monthlyCost', '12,5');
  check('Guardar is enabled now', await page.waitFor(`${footerButton('Guardar')}?.disabled === false`));

  if (screenshotPath) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(screenshotPath.replace(/\.png$/, '-edit.png'), Buffer.from(shot.data, 'base64'));
  }

  await clickFooter('Guardar');
  check('saving returns the drawer to read mode', await page.waitFor(`!document.querySelector('.ant-drawer-open #pi-client') && ${footerButton('Editar')} !== undefined`));
  const saved = await gamaSheet();
  check('the API has the sheet', saved?.lifecycle === 'production' && saved.client === 'ACME', JSON.stringify(saved && { lifecycle: saved.lifecycle, client: saved.client }));
  const env = saved?.environments?.[0];
  check('the environment was saved with URL, hosting and cost', env?.url === 'https://gama.example.com' && env.hosting === 'Vercel' && env.monthlyCostEur === 12.5, JSON.stringify(env));
  check('the read view shows them', await page.evaluate(`['Em produção', 'ACME', 'gama.example.com', 'Vercel'].every((t) => ${drawerText}.includes(t))`));
  const link = await page.evaluate(`(() => { const a = [...document.querySelectorAll('.ant-drawer-open a')].find((x) => x.href.startsWith('https://gama.example.com')); return a && { target: a.target, rel: a.rel }; })()`);
  check('the URL in the drawer opens in a new tab with noopener noreferrer', link?.target === '_blank' && link.rel === 'noopener noreferrer', JSON.stringify(link));
  check('the card behind updated without a reload', await page.evaluate(`${card('Gama')}.textContent.includes('Em produção') && ${card('Gama')}.textContent.includes('Vercel')`));

  // Editar keeps the environment ids.
  await clickFooter('Editar');
  check('Editar opens the form with the saved values', await page.waitFor(`document.querySelector('#pi-client')?.value === 'ACME' && document.querySelector('#pi-env-0-hosting')?.value === 'Vercel'`));
  await fill('#pi-client', 'ACME Lda');
  await clickFooter('Guardar');
  await page.waitFor(`!document.querySelector('.ant-drawer-open #pi-client')`);
  const edited = await gamaSheet();
  check('the edit saved', edited?.client === 'ACME Lda');
  check('the environment keeps its id', edited?.environments?.[0]?.id === env?.id);

  // Five environments at most; Cancelar discards.
  await clickFooter('Editar');
  await page.waitFor(`!!document.querySelector('#pi-client')`);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open button')].find((b) => b.textContent.trim() === 'Adicionar ambiente').click()`);
  }
  check('5 environments in the form', await page.waitFor(`!!document.querySelector('#pi-env-4-name')`));
  check('"Adicionar ambiente" is disabled at 5', await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open button')].find((b) => b.textContent.trim() === 'Adicionar ambiente').disabled`));
  await clickFooter('Cancelar');
  check('Cancelar returns to read mode', await page.waitFor(`!document.querySelector('.ant-drawer-open #pi-client')`));
  check('and discards: still one environment on the API', (await gamaSheet())?.environments?.length === 1);

  // Esc closes the drawer.
  await page.key('Escape', 'Escape', 0, 27);
  check('Esc closes the drawer', await page.waitFor(`!${drawerOpen}`));

  // Apagar ficha, with a confirmation.
  await page.evaluate(`${card('Gama')}.click()`);
  check('clicking the card opens the drawer in read mode', await page.waitFor(`${drawerOpen} && !document.querySelector('#pi-client')`));
  await clickFooter('Apagar ficha');
  check('Apagar ficha asks to confirm', await page.waitFor(`!![...document.querySelectorAll('.ant-modal button')].find((b) => b.textContent.trim() === 'Apagar ficha')`));
  check('nothing deleted before confirming', (await gamaSheet()) !== undefined);
  await page.evaluate(`[...document.querySelectorAll('.ant-modal button')].find((b) => b.textContent.trim() === 'Apagar ficha').click()`);
  check('the sheet is gone from the API', await (async () => { for (let i = 0; i < 40; i++) { if ((await gamaSheet()) === undefined) return true; await sleep(100); } return false; })());
  check('the drawer closed and the card says "Sem informação"', await page.waitFor(`!${drawerOpen} && ${card('Gama')}.textContent.includes('Sem informação')`));

  // location.state.projectPath pre-opens a project (the ⓘ icon of a later phase), from another page.
  await page.evaluate(`document.querySelector('nav[aria-label="Navegação principal"] a[href="/library"]').click()`);
  await page.waitFor(`location.pathname === '/library'`);
  await page.evaluate(`(() => { history.pushState({ usr: { projectPath: ${JSON.stringify(gama)} }, key: 'verify', idx: (history.state?.idx ?? 0) + 1 }, '', '/projects'); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); })()`);
  check('location.state.projectPath opens that project\'s drawer', await page.waitFor(`location.pathname === '/projects' && ${drawerOpen} && ${drawerText}.includes('Gama')`));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
