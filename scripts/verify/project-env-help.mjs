// The (i) next to "Ambientes" in the project form: hovering it shows what goes in each environment field.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-env-help.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2] || undefined);
const { check, finish } = checker();
const page = await openBrowser();
const alfa = instance.projects.Alfa;
const infoButton = `document.querySelector('.ant-drawer-open button[aria-label="O que pôr em Ambientes"]')`;
const popover = `document.querySelector('.ant-popover:not(.ant-popover-hidden)')`;

try {
  check('login', await login(page, instance));
  await page.api('PUT', '/project-infos', { projectPath: alfa, info: { environments: [{ kind: 'production', name: 'Produção' }] } });
  await page.navigate(`${instance.base}/projects`);
  await page.waitFor(`document.querySelectorAll('article[aria-label]').length > 0`);
  await page.evaluate(`[...document.querySelectorAll('article[aria-label]')].find((c) => c.getAttribute('aria-label') === 'Alfa').click()`);
  await page.waitFor(`!!document.querySelector('.ant-drawer-open')`);
  check('no (i) in the read view', (await page.evaluate(`${infoButton} === null`)) === true);
  await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open .ant-drawer-footer button')].find((b) => b.textContent.trim() === 'Editar').click()`);
  check('the (i) sits in the "Ambientes" heading', await page.waitFor(`${infoButton}?.closest('h3')?.textContent.includes('Ambientes') === true`));
  // The drawer slides in: measure once it has settled.
  await sleep(800);
  const box = await page.evaluate(`(() => { const r = ${infoButton}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  check('hovering opens the help', await page.waitFor(`!!${popover}`, 5000));
  const text = await page.evaluate(`${popover}?.textContent ?? ''`);
  for (const field of ['Tipo / Nome', 'URL', 'Hosting', 'Branch / versão em produção', 'Branch de deploy (git)', 'Custo mensal', 'Painel do hosting / Logs', 'Health check']) {
    check(`it explains "${field}"`, text.includes(field));
  }
  check('it says the deploy branch is what the hosting publishes', text.includes('A branch que o hosting publica'));
  check('it says "Branch / versão" updates nothing', text.includes('não atualiza nada'));
  const fits = await page.evaluate(`(() => { const r = ${popover}.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`);
  check('the help fits in the window', fits === true);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await sleep(600);
  check('leaving closes it', (await page.evaluate(`!${popover}`)) === true);
  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
