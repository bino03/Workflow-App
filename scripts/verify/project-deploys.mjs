// Registering and deleting deploys (spec informacao-dos-projetos, step 6): the modal opens over the drawer with "now"
// pre-filled, Registar deploy writes through the API and the list and the card update, the date is editable (and
// required), the newest deploy comes first, deleting asks to confirm, and the 21st deploy pushes the oldest out.
// Every claim on screen is also read back from the API.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/project-deploys.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2] || undefined);
const { check, finish } = checker();
const page = await openBrowser();

const alfa = instance.projects.Alfa;
const cards = `[...document.querySelectorAll('article[aria-label]')]`;
const card = (name) => `${cards}.find((c) => c.getAttribute('aria-label') === ${JSON.stringify(name)})`;
const drawerText = `(document.querySelector('.ant-drawer-open')?.textContent ?? '')`;
const sheet = async () => (await page.api('GET', '/project-infos')).body.find((s) => s.projectPath === alfa);
const deploys = async () => (await sheet())?.environments?.[0]?.deploys ?? [];
const modalOpen = `!![...document.querySelectorAll('.ant-modal')].find((m) => m.textContent.includes('Registar deploy —'))`;
const drawerButton = (label) => `[...document.querySelectorAll('.ant-drawer-open .ant-drawer-body button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const modalButton = (label) => `[...document.querySelectorAll('.ant-modal button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const listItems = `document.querySelectorAll('.ant-drawer-open ul[aria-label^="Deploys de"] li').length`;

async function fill(selector, text) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
  await page.send('Input.insertText', { text });
}

/**
 * A datetime-local is segmented: Input.insertText cannot type into it. This sets the value the way the browser ends
 * up with it after a user picks a date (the native setter + an input event, which is what React listens to).
 */
async function setDateTime(selector, value) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
}

const waitUntil = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
};

try {
  check('login', await login(page, instance));

  // A sheet with one production environment and no deploys.
  const put = await page.api('PUT', '/project-infos', {
    projectPath: alfa,
    info: { lifecycle: 'production', environments: [{ kind: 'production', name: 'Produção', url: 'https://alfa.example.com', hosting: 'Vercel' }] },
  });
  check('seeded the sheet', put.status === 200, String(put.status));
  const environmentId = put.body.environments[0].id;

  await page.navigate(`${instance.base}/projects`);
  check('cards loaded', await page.waitFor(`${cards}.length === 3`));
  await page.evaluate(`${card('Alfa')}.click()`);
  check('the drawer shows "Nenhum deploy registado."', await page.waitFor(`${drawerText}.includes('Nenhum deploy registado.')`));

  // First deploy: "now" pre-filled, version and note.
  await page.evaluate(`${drawerButton('Registar deploy')}.click()`);
  check('Registar deploy opens a modal', await page.waitFor(modalOpen));
  const prefilled = await page.evaluate(`document.querySelector('#deploy-at')?.value`);
  const minutesOff = Math.abs(Date.now() - new Date(prefilled).getTime()) / 60000;
  check('the date is pre-filled with now (datetime-local, to the minute)', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(prefilled) && minutesOff < 2, `${prefilled} (${minutesOff.toFixed(1)} min off)`);
  check('the modal is above the drawer', await page.evaluate(`(() => { const m = document.querySelector('.ant-modal'); const r = m.getBoundingClientRect(); return !!document.elementFromPoint(r.left + r.width / 2, r.top + 20)?.closest('.ant-modal'); })()`));
  check('the footer notes that the date is manual', await page.evaluate(`document.querySelector('.ant-modal').textContent.includes('a app não a lê do git nem do hosting')`));
  await fill('#deploy-version', 'v1.0');
  await fill('#deploy-note', 'primeiro');
  await page.evaluate(`${modalButton('Registar deploy')}.click()`);
  check('saving closes the modal', await page.waitFor(`!(${modalOpen})`));
  const first = await deploys();
  check('the API has the deploy with version and note', first.length === 1 && first[0].version === 'v1.0' && first[0].note === 'primeiro', JSON.stringify(first));
  check('the list shows it', await page.waitFor(`${listItems} === 1 && ${drawerText}.includes('v1.0') && ${drawerText}.includes('primeiro')`));
  check('the card behind shows a recent last deploy', await page.waitFor(`/agora mesmo|há \\d+ min/.test(${card('Alfa')}.textContent)`));

  // Second deploy with an older, edited date: it goes below the newest.
  await page.evaluate(`${drawerButton('Registar deploy')}.click()`);
  await page.waitFor(modalOpen);
  await setDateTime('#deploy-at', '2026-01-15T10:00');
  await fill('#deploy-note', 'mais antigo');
  await page.evaluate(`${modalButton('Registar deploy')}.click()`);
  await page.waitFor(`!(${modalOpen})`);
  const two = await deploys();
  check('the API has 2 deploys, newest first', two.length === 2 && Date.parse(two[0].at) > Date.parse(two[1].at), JSON.stringify(two.map((d) => d.at)));
  check('the edited date is stored as that local time in ISO', two[1]?.at === new Date('2026-01-15T10:00').toISOString(), two[1]?.at);
  check('the list order matches (newest first)', await page.evaluate(`(() => { const t = [...document.querySelectorAll('.ant-drawer-open ul[aria-label^="Deploys de"] li')].map((l) => l.textContent); return t.length === 2 && t[0].includes('primeiro') && t[1].includes('mais antigo'); })()`));
  check('the card still shows the newest deploy', await page.evaluate(`/agora mesmo|há \\d+ min/.test(${card('Alfa')}.textContent)`));

  // The date is required; Cancelar registers nothing.
  await page.evaluate(`${drawerButton('Registar deploy')}.click()`);
  await page.waitFor(modalOpen);
  await setDateTime('#deploy-at', '');
  check('an empty date shows the field error', await page.waitFor(`document.querySelector('#deploy-at-error')?.textContent.includes('Indica a data e a hora.')`));
  check('and Registar deploy is disabled', await page.waitFor(`${modalButton('Registar deploy')}.disabled === true`));
  await page.evaluate(`${modalButton('Cancelar')}.click()`);
  check('Cancelar closes the modal', await page.waitFor(`!(${modalOpen})`));
  check('and registered nothing', (await deploys()).length === 2);

  // Deleting asks to confirm.
  await page.evaluate(`[...document.querySelectorAll('.ant-drawer-open ul[aria-label^="Deploys de"] li')][1].querySelector('button[aria-label^="Apagar o deploy de"]').click()`);
  check('Apagar asks to confirm', await page.waitFor(`!![...document.querySelectorAll('.ant-modal button')].find((b) => b.textContent.trim() === 'Apagar deploy')`));
  check('nothing deleted before confirming', (await deploys()).length === 2);
  await page.evaluate(`${modalButton('Apagar deploy')}.click()`);
  check('the deploy is gone from the API', await waitUntil(async () => (await deploys()).length === 1));
  check('and from the list', await page.waitFor(`${listItems} === 1 && !${drawerText}.includes('mais antigo')`));

  // The 21st deploy pushes the oldest out.
  for (let day = 0; day < 19; day++) {
    const at = new Date(Date.UTC(2025, 0, 1 + day)).toISOString();
    const r = await page.api('POST', '/project-infos/deploys', { projectPath: alfa, environmentId, at, version: `s${day}` });
    if (r.status !== 200) throw new Error(`seed deploy ${day}: ${r.status}`);
  }
  check('20 deploys now', (await deploys()).length === 20);
  // The page only knows what it fetched: reload, then reopen the drawer.
  await page.navigate(`${instance.base}/projects`);
  await page.waitFor(`${cards}.length === 3`);
  await page.evaluate(`${card('Alfa')}.click()`);
  await page.waitFor(`${listItems} === 20`);
  await page.evaluate(`${drawerButton('Registar deploy')}.click()`);
  await page.waitFor(modalOpen);
  check('the modal warns that the oldest will go', await page.evaluate(`document.querySelector('.ant-modal').textContent.includes('Há 20 deploys: o mais antigo sai.')`));
  // Tomorrow, so it is newer than v1.0 (dates go to the minute: two in the same minute tie).
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  await setDateTime('#deploy-at', `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T10:00`);
  await fill('#deploy-version', 'v21');
  await page.evaluate(`${modalButton('Registar deploy')}.click()`);
  await page.waitFor(`!(${modalOpen})`);
  const full = await deploys();
  check('still 20 deploys, the new one first', full.length === 20 && full[0].version === 'v21', `${full.length} ${full[0]?.version}`);
  check('the oldest (s0) left', !full.some((d) => d.version === 's0') && full.some((d) => d.version === 's1'));
  check('the list shows 20 rows', await page.waitFor(`${listItems} === 20`));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
