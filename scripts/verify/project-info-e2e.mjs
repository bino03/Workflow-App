// The flow of the spec's step 7, end to end through the UI: create the sheet of a project in production with a
// staging environment, register two deploys, reload and see it all, edit, refuse a javascript: URL, delete.
// The API is only used to read back what the UI claims. Nothing is seeded.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-info-e2e.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance } from './cdp.mjs';
import { formDriver } from './formDriver.mjs';

const instance = readInstance(process.argv[2] || undefined);
const { check, finish } = checker();
const page = await openBrowser();
const { fill, choose, setDateTime } = formDriver(page);

const alfa = instance.projects.Alfa;
const cards = `[...document.querySelectorAll('article[aria-label]')]`;
const card = (name) => `${cards}.find((c) => c.getAttribute('aria-label') === ${JSON.stringify(name)})`;
const drawerText = `(document.querySelector('.ant-drawer-open')?.textContent ?? '')`;
const sheet = async () => (await page.api('GET', '/project-infos')).body.find((s) => s.projectPath === alfa);
const drawerButton = (label) => `[...document.querySelectorAll('.ant-drawer-open button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const footerButton = (label) => `[...document.querySelectorAll('.ant-drawer-open .ant-drawer-footer button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const modalOpen = `!![...document.querySelectorAll('.ant-modal')].find((m) => m.textContent.includes('Registar deploy —'))`;
const modalButton = (label) => `[...document.querySelectorAll('.ant-modal button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;

async function openAlfa() {
  await page.navigate(`${instance.base}/projects`);
  await page.waitFor(`${cards}.length === 3`);
  await page.evaluate(`${card('Alfa')}.click()`);
  return page.waitFor(`!!document.querySelector('.ant-drawer-open')`);
}

/** Registers a deploy on the environment whose heading is `environmentName`, through its own "Registar deploy". */
async function registerDeploy(environmentName, { version, at }) {
  await page.evaluate(`(() => { const h = [...document.querySelectorAll('.ant-drawer-open h4')].find((x) => x.textContent === ${JSON.stringify(environmentName)}); h.closest('div.p-4').querySelector('h5 ~ button, h5 + button, button').click(); })()`);
  await page.waitFor(modalOpen);
  if (at) await setDateTime('#deploy-at', at);
  await fill('#deploy-version', version);
  await page.evaluate(`${modalButton('Registar deploy')}.click()`);
  return page.waitFor(`!(${modalOpen})`);
}

try {
  check('login', await login(page, instance));
  check('the project starts without a sheet', (await sheet()) === undefined && (await openAlfa()));

  // Create: production + staging, through the form.
  check('the drawer opens in read mode for a project without a sheet', await page.evaluate(`${drawerText}.includes('Ainda não há informação')`));
  await page.evaluate(`${footerButton('Editar')}.click()`);
  await page.waitFor(`!!document.querySelector('#pi-client')`);
  await choose('pi-lifecycle', 'Em produção');
  await fill('#pi-client', 'Worksite');
  await page.evaluate(`${drawerButton('Adicionar ambiente')}.click()`);
  await page.waitFor(`document.querySelector('#pi-env-0-name')?.value === 'Produção'`);
  await fill('#pi-env-0-url', 'https://worksite.example.com');
  await fill('#pi-env-0-hosting', 'Vercel');
  await page.evaluate(`${drawerButton('Adicionar ambiente')}.click()`);
  check('the second environment defaults to staging', await page.waitFor(`document.querySelector('#pi-env-1-name')?.value === 'Staging'`));
  await fill('#pi-env-1-url', 'https://staging.worksite.example.com');
  await fill('#pi-env-1-hosting', 'Railway');
  await page.evaluate(`${footerButton('Guardar')}.click()`);
  check('Guardar returns to read mode', await page.waitFor(`!document.querySelector('#pi-client') && ${drawerText}.includes('Worksite')`));
  const created = await sheet();
  check('the API has production and staging', created?.environments?.map((e) => e.kind).join() === 'production,staging', JSON.stringify(created?.environments?.map((e) => e.kind)));

  // Two deploys on production, the second with an older date.
  check('production got a deploy registered', await registerDeploy('Produção', { version: 'v1.1' }));
  check('and an older one', await registerDeploy('Produção', { version: 'v1.0', at: '2026-01-10T09:30' }));
  const production = (await sheet()).environments[0];
  check('the API has 2 deploys on production, newest first', production.deploys.length === 2 && production.deploys[0].version === 'v1.1' && production.deploys[1].version === 'v1.0', JSON.stringify(production.deploys.map((d) => d.version)));
  check('staging has none', (await sheet()).environments[1].deploys.length === 0);

  // Reload: everything is still there.
  check('reloaded, the drawer opens', await openAlfa());
  check('it shows both environments with URL and hosting', await page.evaluate(`['Produção', 'Staging', 'worksite.example.com', 'staging.worksite.example.com', 'Vercel', 'Railway'].every((t) => ${drawerText}.includes(t))`));
  check('it shows the two deploys of production', await page.evaluate(`['v1.1', 'v1.0'].every((t) => ${drawerText}.includes(t))`));
  await page.key('Escape', 'Escape', 0, 27);
  await page.waitFor(`!document.querySelector('.ant-drawer-open')`);
  const cardText = `${card('Alfa')}.textContent`;
  check('the card shows production: tag, hosting and last deploy', await page.evaluate(`['Em produção', 'Vercel', 'worksite.example.com'].every((t) => ${cardText}.includes(t)) && /agora mesmo|há \\d+ min/.test(${cardText})`));
  const link = await page.evaluate(`(() => { const a = ${card('Alfa')}.querySelector('a'); return a && { href: a.href, target: a.target, rel: a.rel }; })()`);
  check('the URL on the card is a safe external link', link?.href === 'https://worksite.example.com/' && link.target === '_blank' && link.rel === 'noopener noreferrer', JSON.stringify(link));

  // Edit.
  await page.evaluate(`${card('Alfa')}.click()`);
  await page.waitFor(`!!document.querySelector('.ant-drawer-open')`);
  await page.evaluate(`${footerButton('Editar')}.click()`);
  await page.waitFor(`document.querySelector('#pi-client')?.value === 'Worksite'`);
  await fill('#pi-client', 'Worksite Lda');

  // A javascript: URL is refused in the form, and nothing is saved.
  await fill('#pi-repoUrl', 'javascript:alert(1)');
  check('a javascript: URL shows the error', await page.waitFor(`document.querySelector('#pi-repoUrl-error')?.textContent.includes('http://')`));
  check('and Guardar is disabled', await page.waitFor(`${footerButton('Guardar')}.disabled === true`));
  await fill('#pi-repoUrl', 'https://github.com/example/worksite');
  await page.waitFor(`${footerButton('Guardar')}.disabled === false`);
  await page.evaluate(`${footerButton('Guardar')}.click()`);
  await page.waitFor(`!document.querySelector('#pi-client')`);
  const edited = await sheet();
  check('the edit saved, and kept both environments and their deploys', edited?.client === 'Worksite Lda' && edited.repoUrl === 'https://github.com/example/worksite' && edited.environments.length === 2 && edited.environments[0].deploys.length === 2, JSON.stringify({ client: edited?.client, envs: edited?.environments?.length }));

  // Delete.
  await page.evaluate(`${footerButton('Apagar ficha')}.click()`);
  await page.waitFor(`!![...document.querySelectorAll('.ant-modal button')].find((b) => b.textContent.trim() === 'Apagar ficha')`);
  await page.evaluate(`${modalButton('Apagar ficha')}.click()`);
  check('the sheet is deleted and the card says "Sem informação"', await page.waitFor(`!document.querySelector('.ant-drawer-open') && ${card('Alfa')}.textContent.includes('Sem informação')`));
  check('the API has no sheet', (await sheet()) === undefined);

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
