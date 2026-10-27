// The screenshots to attach (ADR 0024): the card "Prints a anexar" right after the letter, the thumbnails served from
// the portfolio, Descarregar under the Upwork name, Copiar legendas, a missing image and a project without screenshots.
// The skill is simulated as in upwork.mjs: the scenario writes the package and attachments.json by hand. The portfolio
// is only read.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh --git-workflow --portfolio "<the portfolio>"
//   node scripts/verify/upwork-attachments.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
if (!instance.portfolioPath) {
  console.error('start the instance with --portfolio <the portfolio> (PORTFOLIO_PATH)');
  process.exit(1);
}
const page = await openBrowser();

const q = (value) => JSON.stringify(value);
const click = (expr) => page.evaluate(`(${expr}).click()`);
const button = (label, scope = 'document') => `[...${scope}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${q(label)})`;
const has = (text, scope = 'document.body') => `${scope}.innerText.includes(${q(text)})`;
const cards = `document.querySelectorAll('ul[aria-label="Candidaturas"] li')`;
const card = (title) => `[...${cards}].find((li) => li.innerText.includes(${q(title)})).querySelector('button')`;
const prints = `document.querySelector('section[aria-label="Prints a anexar"]')`;
const tiles = `${prints}.querySelectorAll('figure')`;

// Two screenshots that exist in the portfolio's SIGA catalog, one that does not.
const catalog = JSON.parse(readFileSync(join(instance.portfolioPath, 'public', 'images', 'projects', 'siga', 'screenshots.json'), 'utf8'));
const [first, second] = catalog.images;
const ITEMS = [
  { project: 'SIGA', slug: 'siga', file: first.file, uploadName: 'siga-01-calendar.png', caption: `${first.upwork} Same pattern as your booking flow.` },
  { project: 'SIGA', slug: 'siga', file: second.file, uploadName: 'siga-02-request-list.png', caption: second.upwork },
  { project: 'SIGA', slug: 'siga', file: 'nao-existe.png', uploadName: 'siga-03-gone.png', caption: 'A screenshot that is not in the portfolio.' },
];

const guidedDir = (gid) => join(instance.dataDir, 'guided', gid);
const PARTS = {
  'analysis.md': '**Vale a pena: sim.**',
  'cover-letter.md': 'I built a booking platform for a students union.\n\nScreenshots attached.',
  'screening.md': 'No screening questions.',
  'plan.md': '- Next.js',
  'client-questions.md': '1. Who approves bookings?',
};
const writePackage = (gid, title) => {
  for (const [name, body] of Object.entries(PARTS)) writeFileSync(join(guidedDir(gid), name), body);
  writeFileSync(
    join(guidedDir(gid), 'attachments.json'),
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items: ITEMS, missing: ['GymApp'] }),
  );
  const files = { analysis: 'analysis.md', coverLetter: 'cover-letter.md', screening: 'screening.md', plan: 'plan.md', clientQuestions: 'client-questions.md' };
  writeFileSync(join(guidedDir(gid), 'package.json'), JSON.stringify({ version: 1, title, language: 'en', verdict: 'apply', updatedAt: new Date().toISOString(), files }));
  writeFileSync(join(guidedDir(gid), 'event.json'), JSON.stringify({ event: 'Stop', at: new Date().toISOString() }));
};

try {
  check('anonymous attachment is refused', (await fetch(`${instance.base}/api/upwork/applications/x/attachments/0`)).status === 401);
  check('login', await login(page, instance));
  await page.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: instance.base });
  await page.api('PUT', '/upwork/profile', { markdown: '# Quem sou\nDev full-stack.' });
  const { body: app } = await page.api('POST', '/upwork/applications', { job: 'Booking platform', screeningQuestions: [] });
  writePackage(app.guidedId, 'Booking platform');

  await page.navigate(`${instance.base}/upwork`);
  await page.waitFor(`${cards}.length === 1`, 15000);
  await click(card('Booking platform'));
  check('the card shows up', await page.waitFor(`!!${prints}`, 15000));
  const order = await page.evaluate(`[...document.querySelectorAll('section.card')].map((s) => s.getAttribute('aria-label')).join('|')`);
  check('right after the letter', order.includes('Carta|Prints a anexar|Respostas de triagem'), order);
  check('three tiles, in order', await page.evaluate(`[...${tiles}].map((f) => f.innerText.includes('siga-0')).every(Boolean) && ${tiles}.length === 3`));
  check(
    'the two portfolio images load (from the backend)',
    await page.waitFor(`[...${tiles}].slice(0, 2).every((f) => { const img = f.querySelector('img'); return img && img.complete && img.naturalWidth > 0; })`, 15000),
  );
  check('the missing one says so, without an <img>', await page.evaluate(`!${tiles}[2].querySelector('img') && ${has('Imagem não encontrada no portfólio', `${tiles}[2]`)}`));
  check('its Descarregar is disabled', await page.evaluate(`${tiles}[2].querySelector('a, button[disabled]') !== null && [...${tiles}[2].querySelectorAll('a, button')].some((b) => b.disabled || b.getAttribute('aria-disabled') === 'true' || b.classList.contains('ant-btn-disabled'))`));
  check('the project without screenshots is named', await page.evaluate(has('Sem prints no portfólio: GymApp', prints)));

  // Descarregar: the link asks for ?download=1, and the backend names the file for the Upwork.
  const href = await page.evaluate(`${tiles}[0].querySelector('a').getAttribute('href')`);
  check('Descarregar links to ?download=1', href === `/api/upwork/applications/${app.id}/attachments/0?download=1`, href);
  const download = await page.evaluate(`fetch(${q(href)}).then((r) => ({ status: r.status, type: r.headers.get('content-type'), disposition: r.headers.get('content-disposition') }))`);
  check('download: 200, image/png, attachment under its uploadName', download.status === 200 && download.type === 'image/png' && download.disposition === 'attachment; filename="siga-01-calendar.png"', JSON.stringify(download));
  const gone = await page.evaluate(`fetch('/api/upwork/applications/${app.id}/attachments/2').then((r) => r.status)`);
  check('the missing one → 404', gone === 404, String(gone));

  // Copiar legendas: every caption, numbered, with the upload names. The clipboard needs a focused document (nothing
  // was typed in this scenario), and the Windows clipboard turns \n into \r\n.
  await page.send('Page.bringToFront');
  await page.evaluate(`${button('Copiar legendas', prints)}.focus()`);
  await click(button('Copiar legendas', prints));
  const clipboard = async () => (await page.evaluate('navigator.clipboard.readText()')).replaceAll('\r\n', '\n');
  const copied = await clipboard();
  check('Copiar legendas copies them all, numbered', copied.startsWith('1. siga-01-calendar.png — ') && copied.includes('\n3. siga-03-gone.png — '), copied.slice(0, 120));
  await click(`[...${tiles}[1].querySelectorAll('button')].find((b) => b.textContent.includes('Copiar legenda'))`);
  check('Copiar legenda copies just that one', (await clipboard()) === ITEMS[1].caption);

  // Preparar anexos: the two in the portfolio copied under their Upwork names; the missing one named. The instance runs
  // with OPEN_FOLDERS=false, so no Explorer window — the banner says where the folder is instead.
  await click(button('Preparar anexos', prints));
  check('Preparar anexos shows the banner', await page.waitFor(`!!${prints}.querySelector('.status-banner')`, 10000));
  const anexos = join(instance.dataDir, 'upwork', 'applications', app.id, 'anexos');
  check('the banner names the folder', await page.evaluate(has(anexos, prints)));
  check('the missing one is named as left out', await page.evaluate(has('Ficaram de fora (não estão no portfólio): siga-03-gone.png', prints)));
  check(
    'the folder has the two, under their Upwork names',
    ['siga-01-calendar.png', 'siga-02-request-list.png'].every((name) => existsSync(join(anexos, name))) && !existsSync(join(anexos, 'siga-03-gone.png')),
  );

  // Archived: the list and the images stay.
  await page.api('PATCH', `/upwork/applications/${app.id}`, { status: 'withdrawn' });
  const archived = await page.api('POST', `/upwork/applications/${app.id}/archive`);
  check('archive keeps attachments.json', archived.body.attachments?.items.length === 3 && existsSync(join(instance.dataDir, 'upwork', 'applications', app.id, 'package', 'attachments.json')));
  const afterArchive = await page.evaluate(`fetch('/api/upwork/applications/${app.id}/attachments/0').then((r) => r.status)`);
  check('archived: the image is still served', afterArchive === 200, String(afterArchive));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}

// From the laptop (ADR 0026): the same app opened under another name — Chrome resolves wfa-remote.test to this machine,
// as the tailnet name would be. The button is Descarregar todos and the files land in this browser's downloads.
const remoteBase = instance.base.replace('localhost', 'wfa-remote.test');
const laptop = await openBrowser({ cdpPort: 9336, args: ['--host-resolver-rules=MAP wfa-remote.test 127.0.0.1'] });
const downloads = mkdtempSync(join(tmpdir(), 'wfa-downloads-'));
try {
  check('laptop: login under another name', await login(laptop, { ...instance, base: remoteBase }));
  await laptop.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const { body: app } = await laptop.api('POST', '/upwork/applications', { job: 'Booking from the laptop', screeningQuestions: [] });
  writePackage(app.guidedId, 'Booking from the laptop');
  await laptop.navigate(`${remoteBase}/upwork`);
  await laptop.waitFor(`${cards}.length >= 1`, 15000);
  await laptop.evaluate(`(${card('Booking from the laptop')}).click()`);
  await laptop.waitFor(`!!${prints}`, 15000);
  check('laptop: the button is Descarregar todos', await laptop.evaluate(`!!${button('Descarregar todos', prints)} && !${button('Preparar anexos', prints)}`));
  await laptop.evaluate(`(${button('Descarregar todos', prints)}).click()`);
  check('laptop: the banner points to Downloads', await laptop.waitFor(has('descarregados para a pasta Downloads deste computador', prints), 15000));
  check('laptop: no server path in the banner', !(await laptop.evaluate(has(instance.dataDir, prints))));
  let names = [];
  for (let i = 0; i < 40 && names.length < 2; i++) {
    names = readdirSync(downloads).filter((name) => !name.endsWith('.crdownload')).sort();
    await new Promise((r) => setTimeout(r, 250));
  }
  check('laptop: both files downloaded under their Upwork names', names.join(',') === 'siga-01-calendar.png,siga-02-request-list.png', names.join(','));
  const anexos = join(instance.dataDir, 'upwork', 'applications', app.id, 'anexos');
  check('laptop: the record copy is made on the server too', existsSync(join(anexos, 'siga-01-calendar.png')));
  check('laptop: no console errors', laptop.errors.length === 0, laptop.errors.join(' | '));
} catch (error) {
  check('laptop part ran to the end', false, error.message);
} finally {
  await laptop.close();
  rmSync(downloads, { recursive: true, force: true });
}
process.exit(finish());
