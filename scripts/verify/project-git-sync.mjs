// Automatic deploys from git (ADR 0034): the "Branch de deploy" field validates, saving it brings the tip of
// origin/<branch> into the history as a "git" deploy, "Atualizar do git" brings a new merge, warnings stay discreet
// (a branch the remote lacks, a folder that is not a repository), opening /projects syncs in the background without a
// notification — and one project points at a real remote (GitHub), whose tip and commit date the deploy must match.
// Every claim on screen is also read back from the API.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-git-sync.mjs [run dir] [real remote URL]
//   node scripts/verify/instance.mjs stop --clean
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';
import { formDriver } from './formDriver.mjs';

const instance = readInstance(process.argv[2] || undefined);
const realRemote = process.argv[3] || null;
const { check, finish } = checker();

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();

// Alfa: a clone-like repo whose origin is a local bare repository, fed by a "developer" clone (a merge on GitHub).
const alfa = instance.projects.Alfa;
const beta = instance.projects.Beta;
const gama = instance.projects.Gama;
const origin = join(instance.rootsDir, 'alfa-origin.git');
const dev = join(instance.rootsDir, 'alfa-dev');
git(instance.rootsDir, 'init', '-q', '--bare', '-b', 'main', origin);
git(instance.rootsDir, 'clone', '-q', origin, dev);
git(dev, 'config', 'user.email', 'verify@example.com');
git(dev, 'config', 'user.name', 'Verify');
let counter = 0;
const pushCommit = (subject) => {
  writeFileSync(join(dev, `f${counter++}.txt`), subject);
  git(dev, 'add', '.');
  git(dev, 'commit', '-q', '-m', subject);
  git(dev, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  return git(dev, 'rev-parse', 'HEAD');
};
const firstTip = pushCommit('Merge pull request #1 from feat/primeiro');
mkdirSync(alfa, { recursive: true });
git(alfa, 'init', '-q');
git(alfa, 'remote', 'add', 'origin', origin);
// Gama: the same, but origin is a real remote.
if (realRemote) {
  git(gama, 'init', '-q');
  git(gama, 'remote', 'add', 'origin', realRemote);
}

const page = await openBrowser();
const { fill } = formDriver(page);
const cards = `[...document.querySelectorAll('article[aria-label]')]`;
const card = (name) => `${cards}.find((c) => c.getAttribute('aria-label') === ${JSON.stringify(name)})`;
const drawerText = `(document.querySelector('.ant-drawer-open')?.textContent ?? '')`;
const footerButton = (label) => `[...document.querySelectorAll('.ant-drawer-open .ant-drawer-footer button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const bodyButton = (label) => `[...document.querySelectorAll('.ant-drawer-open .ant-drawer-body button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const listItems = `document.querySelectorAll('.ant-drawer-open ul[aria-label^="Deploys de"] li').length`;
const sheet = async (path) => (await page.api('GET', '/project-infos')).body.find((s) => s.projectPath === path);
const notifications = `document.querySelectorAll('.ant-notification-notice').length`;
const iso = (date) => new Date(date).toISOString();

async function openDrawer(name) {
  await page.navigate(`${instance.base}/projects`);
  await page.waitFor(`${cards}.length === 3`);
  await page.evaluate(`${card(name)}.click()`);
  return page.waitFor(`${drawerText}.includes(${JSON.stringify(name)})`);
}
async function closeDrawer() {
  await page.evaluate(`${footerButton('Fechar')}?.click()`);
  await sleep(300);
}

try {
  check('login', await login(page, instance));

  // 1. The field: an option-looking name is refused, `main` saves, and saving brings the tip at once.
  const seeded = await page.api('PUT', '/project-infos', { projectPath: alfa, info: { lifecycle: 'production', environments: [{ kind: 'production', name: 'Produção' }] } });
  check('seeded Alfa without a deploy branch', seeded.status === 200 && seeded.body.environments[0].deployBranch === null);
  check('Alfa drawer opens', await openDrawer('Alfa'));
  check('no "Atualizar do git" without a deploy branch', (await page.evaluate(`${bodyButton('Atualizar do git')} === undefined`)) === true);
  await page.evaluate(`${footerButton('Editar')}.click()`);
  check('the form has "Branch de deploy (git)"', await page.waitFor(`!!document.querySelector('#pi-env-0-deployBranch')`));
  await fill('#pi-env-0-deployBranch', '--upload-pack=x');
  check('an option-looking branch shows the error', await page.waitFor(`${drawerText}.includes('Um nome de branch')`));
  check('and Guardar is disabled', await page.waitFor(`${footerButton('Guardar')}?.disabled === true`));
  const refused = await page.api('PUT', '/project-infos', { projectPath: alfa, info: { environments: [{ kind: 'production', name: 'Produção', deployBranch: '--upload-pack=x' }] } });
  check('the backend refuses it too (400 COMMON_001)', refused.status === 400 && refused.body.errorCode === 'COMMON_001', JSON.stringify(refused.body));
  await fill('#pi-env-0-deployBranch', 'main');
  check('Guardar is enabled with "main"', await page.waitFor(`${footerButton('Guardar')}?.disabled === false`));
  await page.evaluate(`${footerButton('Guardar')}.click()`);
  check('saving shows the git deploy without pressing anything', await page.waitFor(`${drawerText}.includes(${JSON.stringify(firstTip.slice(0, 7))})`, 15000));
  check('the read view shows origin/main', await page.evaluate(`${drawerText}.includes('origin/main')`));
  check('the deploy carries the "git" tag', await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open ul[aria-label^="Deploys de"] .tag')].some((t) => t.textContent.trim() === 'git')`));
  check('the subject is the note', await page.evaluate(`${drawerText}.includes('Merge pull request #1 from feat/primeiro')`));
  let env = (await sheet(alfa)).environments[0];
  const committed = git(dev, 'log', '-1', '--format=%cI', firstTip);
  check('API: one git deploy with the full hash and the committer date', env.deploys.length === 1 && env.deploys[0].source === 'git' && env.deploys[0].commit === firstTip && env.deploys[0].at === iso(committed), JSON.stringify(env.deploys));
  check('API: lastGitCommit is the tip', env.lastGitCommit === firstTip);

  // 2. A new merge → "Atualizar do git" → two deploys, newest first. Pressing again adds nothing.
  const secondTip = pushCommit('Merge pull request #2 from feat/segundo');
  check('"Atualizar do git" is there', await page.waitFor(`${bodyButton('Atualizar do git')} !== undefined`));
  await page.evaluate(`${bodyButton('Atualizar do git')}.click()`);
  check('the new merge appears', await page.waitFor(`${listItems} === 2 && ${drawerText}.includes(${JSON.stringify(secondTip.slice(0, 7))})`, 15000));
  await page.evaluate(`${bodyButton('Atualizar do git')}.click()`);
  await sleep(1500);
  env = (await sheet(alfa)).environments[0];
  check('pressing again adds nothing (same commit)', env.deploys.length === 2 && (await page.evaluate(listItems)) === 2);
  check('newest first', env.deploys[0].commit === secondTip && env.deploys[1].commit === firstTip);
  check('the owner’s working tree is untouched', git(alfa, 'status', '--porcelain') === '');

  // 3. A staging branch the remote lacks → a discreet warning on that environment only, no notification.
  const ids = (await sheet(alfa)).environments.map((e) => e.id);
  await page.api('PUT', '/project-infos', {
    projectPath: alfa,
    info: { lifecycle: 'production', environments: [{ id: ids[0], kind: 'production', name: 'Produção', deployBranch: 'main' }, { kind: 'staging', name: 'Staging', deployBranch: 'nope' }] },
  });
  await closeDrawer();
  check('Alfa drawer reopens', await openDrawer('Alfa'));
  await page.evaluate(`${bodyButton('Atualizar do git')}.click()`);
  check('the warning for the missing branch shows', await page.waitFor(`${drawerText}.includes('A branch nope não existe no origin.')`, 15000));
  check('it is a status line, not a notification', (await page.evaluate(notifications)) === 0);
  check('production keeps its two deploys', (await sheet(alfa)).environments[0].deploys.length === 2);
  await closeDrawer();

  // 4. A folder that is not a repository.
  await page.api('PUT', '/project-infos', { projectPath: beta, info: { environments: [{ kind: 'production', name: 'Produção', deployBranch: 'main' }] } });
  check('Beta drawer opens', await openDrawer('Beta'));
  await page.evaluate(`${bodyButton('Atualizar do git')}.click()`);
  check('Beta warns it is not a repository', await page.waitFor(`${drawerText}.includes('não está num repositório git')`, 15000));
  check('Beta has no deploys', (await sheet(beta)).environments[0].deploys.length === 0);
  await closeDrawer();

  // 5. Opening /projects again syncs in the background (inside 5 min: skipped, but the warnings come back).
  const before = page.errors.length;
  await page.navigate(`${instance.base}/projects`);
  await page.waitFor(`${cards}.length === 3`);
  await sleep(1500);
  check('no notification on opening /projects', (await page.evaluate(notifications)) === 0);
  await page.evaluate(`${card('Beta')}.click()`);
  check('after a reload the Beta warning is still there (from the skipped sync)', await page.waitFor(`${drawerText}.includes('não está num repositório git')`, 5000));
  await closeDrawer();
  check('no console errors on the reload', page.errors.length === before, page.errors.slice(before).join(' | '));

  // 6. A real remote: the deploy is the tip of main on GitHub, with that commit's committer date.
  if (realRemote) {
    const [remoteTip] = git(instance.rootsDir, 'ls-remote', realRemote, 'refs/heads/main').split(/\s+/);
    await page.api('PUT', '/project-infos', { projectPath: gama, info: { environments: [{ kind: 'production', name: 'Produção', deployBranch: 'main' }] } });
    const synced = await page.api('POST', '/project-infos/git-sync', { projectPath: gama, force: true });
    const deploy = synced.body.info?.environments[0]?.deploys[0];
    check('real remote: no warnings', synced.status === 200 && synced.body.warnings.length === 0, JSON.stringify(synced.body.warnings));
    check('real remote: the deploy is the tip of main (ls-remote)', deploy?.commit === remoteTip, `${deploy?.commit} vs ${remoteTip}`);
    const date = git(gama, 'log', '-1', '--format=%cI', 'refs/remotes/origin/main');
    check('real remote: the date is the commit’s committer date', deploy?.at === iso(date), `${deploy?.at} vs ${date}`);
    check('Gama drawer opens', await openDrawer('Gama'));
    check('real remote: the drawer shows the short hash with the git tag', await page.waitFor(`${drawerText}.includes(${JSON.stringify(remoteTip.slice(0, 7))})`));
    await closeDrawer();
  }

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
