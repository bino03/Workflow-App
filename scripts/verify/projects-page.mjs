// The Projects page (spec informacao-dos-projetos, step 4): one card per project of the registry joined with its
// sheet, lifecycle chips, search, the nav item. The sheets are seeded through the API and the DOM is read back —
// every claim on screen is also checked against the API, never by a screenshot alone.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/projects-page.mjs [run dir] [screenshot path]
//   node scripts/verify/instance.mjs stop --clean
import { writeFileSync } from 'node:fs';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2] || undefined);
const screenshotPath = process.argv[3];
const { check, finish } = checker();
const page = await openBrowser();

const cards = `[...document.querySelectorAll('article[aria-label]')]`;
const card = (name) => `${cards}.find((c) => c.getAttribute('aria-label') === ${JSON.stringify(name)})`;
const chip = (label) => `[...document.querySelectorAll('[role="group"][aria-label="Filtrar por ciclo de vida"] button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)}))`;
const names = () => page.evaluate(`${cards}.map((c) => c.getAttribute('aria-label')).sort()`);

const daysAgo = (days) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

try {
  check('login', await login(page, instance));

  // Reached through the nav item, like a user.
  check('the nav has a "Projetos" item', await page.waitFor(`!![...document.querySelectorAll('nav[aria-label="Navegação principal"] a')].find((a) => a.textContent.trim() === 'Projetos')`));
  await page.evaluate(`[...document.querySelectorAll('nav[aria-label="Navegação principal"] a')].find((a) => a.textContent.trim() === 'Projetos').click()`);
  check('the item opens /projects', await page.waitFor(`location.pathname === '/projects'`));
  check('the item is highlighted (inset accent underline)', await page.waitFor(`getComputedStyle([...document.querySelectorAll('nav[aria-label="Navegação principal"] a')].find((a) => a.textContent.trim() === 'Projetos')).boxShadow !== 'none'`));

  // Fresh instance: every registry project, none with a sheet.
  check('3 cards, one per project of the registry', await page.waitFor(`${cards}.length === 3`));
  const registry = (await page.api('GET', '/projects')).body.map((p) => p.name).sort();
  check('the cards are exactly GET /api/projects', JSON.stringify(await names()) === JSON.stringify(registry), JSON.stringify(await names()));
  check('a project without a sheet says "Sem informação"', await page.evaluate(`${card('Alfa')}.textContent.includes('Sem informação')`));

  // Seed: Alfa in production with a URL, hosting and a deploy 3 days ago; Beta in development, no environment.
  const put = (name, info) => page.api('PUT', '/project-infos', { projectPath: instance.projects[name], info });
  const alfa = await put('Alfa', {
    lifecycle: 'production',
    environments: [{ kind: 'production', name: 'Produção', url: 'https://alfa.example.com/', hosting: 'Vercel' }],
  });
  check('PUT Alfa → 200', alfa.status === 200, String(alfa.status));
  const deploy = await page.api('POST', '/project-infos/deploys', {
    projectPath: instance.projects.Alfa,
    environmentId: alfa.body.environments[0].id,
    at: daysAgo(3),
    version: 'v1',
  });
  check('POST deploy → 200', deploy.status === 200, String(deploy.status));
  check('PUT Beta → 200', (await put('Beta', { lifecycle: 'development' })).status === 200);
  const bad = await put('Gama', { repoUrl: 'javascript:alert(1)' });
  check('a javascript: URL is refused (400, COMMON_001)', bad.status === 400 && bad.body?.errorCode === 'COMMON_001', `${bad.status} ${bad.body?.errorCode}`);

  await page.navigate(`${instance.base}/projects`);
  check('reloaded: 3 cards again', await page.waitFor(`${cards}.length === 3`));

  const alfaText = `${card('Alfa')}.textContent`;
  check('Alfa: tag "Em produção"', await page.evaluate(`${alfaText}.includes('Em produção')`));
  const link = await page.evaluate(`(() => { const a = ${card('Alfa')}.querySelector('a'); return a && { href: a.href, target: a.target, rel: a.rel, text: a.textContent }; })()`);
  check('Alfa: the URL is a link that opens in a new tab with noopener noreferrer', link?.href === 'https://alfa.example.com/' && link.target === '_blank' && link.rel === 'noopener noreferrer', JSON.stringify(link));
  check('Alfa: the link text drops the protocol', link?.text === 'alfa.example.com', link?.text);
  check('Alfa: hosting Vercel', await page.evaluate(`${alfaText}.includes('Vercel')`));
  check('Alfa: last deploy "há 3 dias"', await page.evaluate(`${alfaText}.includes('há 3 dias')`));
  check('Beta: tag "Em desenvolvimento", no link', (await page.evaluate(`${card('Beta')}.textContent.includes('Em desenvolvimento') && !${card('Beta')}.querySelector('a')`)) === true);
  check('Gama (its PUT was refused): still "Sem informação"', await page.evaluate(`${card('Gama')}.textContent.includes('Sem informação')`));

  // Chips (with counts) and search.
  check('chip "Em produção" counts 1', await page.evaluate(`${chip('Em produção')}.textContent.includes('1')`));
  check('chip "Todos" counts 3', await page.evaluate(`${chip('Todos')}.textContent.includes('3')`));
  await page.evaluate(`${chip('Em produção')}.click()`);
  check('filtering by "Em produção" leaves Alfa only', await page.waitFor(`${cards}.length === 1`) && (await names())[0] === 'Alfa');
  check('the chip is pressed', await page.evaluate(`${chip('Em produção')}.getAttribute('aria-pressed') === 'true'`));
  await page.evaluate(`${chip('Arquivado')}.click()`);
  check('an empty filter says so', await page.waitFor(`document.body.textContent.includes('Nenhum projeto com esse filtro')`));
  await page.evaluate(`${chip('Todos')}.click()`);
  check('"Todos" brings the 3 back', await page.waitFor(`${cards}.length === 3`));
  await page.type('input[aria-label="Pesquisar projetos"]', 'gam');
  check('searching "gam" leaves Gama only', (await page.waitFor(`${cards}.length === 1`)) && (await names())[0] === 'Gama');

  if (screenshotPath) {
    await page.evaluate(`(() => { const i = document.querySelector('input[aria-label="Pesquisar projetos"]'); i.focus(); document.execCommand('selectAll'); document.execCommand('delete'); })()`);
    await page.waitFor(`${cards}.length === 3`);
    await sleep(300);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));
  }

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
