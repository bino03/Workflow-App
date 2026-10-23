// Example scenario and smoke check: login through the form, the seeded registry over the API and in the
// sidebar, no console errors. Copy it as the starting point of a new check.
//
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/smoke.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();
try {
  check('anonymous /api/terminals is refused', (await fetch(`${instance.base}/api/terminals`)).status === 401);
  check('login through the form lands on /terminals', await login(page, instance));

  const me = await page.api('GET', '/auth/me');
  check('/api/auth/me is the generated user', me.status === 200 && me.body?.username === instance.username, JSON.stringify(me));

  const projects = await page.api('GET', '/projects');
  const expected = Object.keys(instance.projects);
  check(
    'the registry has the seeded projects',
    projects.status === 200 && expected.every((name) => projects.body?.some?.((p) => p.name === name)),
    JSON.stringify(projects.body?.map?.((p) => p.name) ?? projects),
  );
  check('the sidebar is rendered', await page.waitFor(`!!document.querySelector('nav[aria-label="Projetos"]')`));
  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
