// The state labels of the guided sessions outside the creation (tokens-and-colors §3, decided 2026-11-22): a question,
// a permission and `needs-you` read "Precisa de ti" with the solid diamond; `waiting-text` reads "À tua espera" with the
// empty one (`.is-idle`). Checks the Library's import banner and an Upwork application (status tag + the "precisa de ti"
// banner over the package). Nothing runs for real: the scenario answers the reads (Fetch.requestPaused) with a fake
// import / application / guided view, so it needs no skill, no Workflow and no claude login. Proof by DOM.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/guided-state-labels.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const now = new Date().toISOString();
const IMPORT = {
  id: 'imp-1',
  kind: 'skill',
  sourceLabel: 'https://example.com/skill.md',
  status: 'needs-you',
  terminalId: 't-imp',
  createdAt: now,
  result: null,
  changedFiles: 0,
  error: null,
};
let guidedStatus = 'question';
const guided = () => ({
  id: 'g-1',
  purpose: 'upwork',
  status: guidedStatus,
  terminalId: 't-g',
  createdAt: now,
  mode: 'ask',
  remote: false,
  display: null,
  pending: null,
  result: null,
  error: null,
});
const PACKAGE = {
  title: 'App de reservas',
  language: 'pt',
  verdict: 'apply',
  updatedAt: now,
  analysis: '# Análise\nVale a pena.',
  coverLetter: 'Olá,\nCarta.',
  screening: null,
  plan: null,
  clientQuestions: null,
};
const application = () => ({
  id: 'app-1',
  title: 'App de reservas',
  url: null,
  clientName: null,
  status: 'draft',
  history: [{ status: 'draft', at: now }],
  connectsSpent: null,
  notes: '',
  guidedId: 'g-1',
  agreement: null,
  creationGuidedId: null,
  projectPath: null,
  archived: false,
  createdAt: now,
  updatedAt: now,
  guided: guided(),
  package: PACKAGE,
  packageError: null,
  attachments: null,
  attachmentsError: null,
});

const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const fake = {
  '/api/library/imports/current': () => IMPORT,
  '/api/upwork/profile': () => ({ markdown: '# Perfil', updatedAt: now }),
  '/api/upwork/applications': () => [application()],
  '/api/upwork/applications/app-1': () => application(),
  '/api/guided/g-1': () => guided(),
  '/api/guided/g-1/feed': () => ({ entries: [{ id: 'e1', type: 'assistant-text', markdown: 'Olá.', at: now }], cursor: 'c1' }),
};
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const answer = request.method === 'GET' && fake[new URL(request.url).pathname];
  if (answer) {
    return void page.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: json(answer()) });
  }
  return void page.send('Fetch.continueRequest', { requestId });
});

const banner = `document.querySelector('.status-banner')`;
const statusTag = `document.querySelector('[aria-label="Candidatura aberta"] [data-status]')`;
const tagOf = () =>
  page.evaluate(`(() => { const t = ${statusTag}; return t ? { status: t.dataset.status, text: t.textContent.trim(), cls: t.className, icon: t.querySelector('.state-icon').className } : null; })()`);

try {
  check('login', await login(page, instance));
  await page.send('Fetch.enable', {
    patterns: [
      { urlPattern: '*/api/library/imports/current', requestStage: 'Request' },
      { urlPattern: '*/api/upwork/applications*', requestStage: 'Request' },
      { urlPattern: '*/api/upwork/profile', requestStage: 'Request' },
      { urlPattern: '*/api/guided/g-1*', requestStage: 'Request' },
    ],
  });

  // ── 1. Library: the import banner in needs-you ──
  await page.navigate(`${instance.base}/library`);
  check('library: the import banner shows up', await page.waitFor(`!!${banner} && ${banner}.innerText.includes('A skill precisa de ti')`, 10000));
  const imp = await page.evaluate(`({ text: ${banner}.innerText.replace(/\\s+/g, ' '), cls: ${banner}.className, icon: ${banner}.querySelector('.state-icon').className })`);
  check('import needs-you: "A skill precisa de ti — tem uma pergunta ou precisa de uma permissão."', imp.text.includes('A skill precisa de ti — tem uma pergunta ou precisa de uma permissão.'), imp.text);
  check('import needs-you: solid diamond (is-wait) in an is-wait banner', imp.icon === 'state-icon is-wait' && imp.cls.includes('is-wait'), `${imp.icon} / ${imp.cls}`);
  check('import: no old "à tua espera" wording', !/à tua espera/i.test(imp.text));

  // ── 2. Upwork: a question → "Precisa de ti" + the banner over the package ──
  await page.navigate(`${instance.base}/upwork`);
  await page.waitFor(`!!document.querySelector('ul[aria-label="Candidaturas"] li')`, 10000);
  await page.evaluate(`(document.querySelector('ul[aria-label="Candidaturas"] li button') ?? document.querySelector('ul[aria-label="Candidaturas"] li')).click()`);
  check('upwork: the application opens', await page.waitFor(`!!${statusTag}`, 10000));
  let tag = await tagOf();
  check('question → tag "Precisa de ti", tag-wait, solid diamond', tag?.status === 'question' && tag.text === 'Precisa de ti' && tag.cls === 'tag-wait' && tag.icon === 'state-icon is-wait', JSON.stringify(tag));
  const pkgBanner = await page.evaluate(`[...document.querySelectorAll('.status-banner.is-wait')].map((b) => ({ text: b.innerText.replace(/\\s+/g, ' '), icon: b.querySelector('.state-icon').className }))`);
  check(
    'package tab: banner "O Claude precisa de ti na conversa." with the solid diamond',
    pkgBanner.some((b) => b.text.includes('O Claude precisa de ti na conversa.') && b.icon === 'state-icon is-wait'),
    JSON.stringify(pkgBanner),
  );

  // ── 3. permission / needs-you read the same ──
  for (const status of ['permission', 'needs-you']) {
    guidedStatus = status;
    const ok = await page.waitFor(`${statusTag}?.dataset.status === ${JSON.stringify(status)}`, 10000);
    tag = await tagOf();
    check(`${status} → "Precisa de ti", solid diamond`, ok && tag.text === 'Precisa de ti' && tag.icon === 'state-icon is-wait', JSON.stringify(tag));
  }

  // ── 4. waiting-text → "À tua espera", empty diamond, no "precisa de ti" banner ──
  guidedStatus = 'waiting-text';
  const waited = await page.waitFor(`${statusTag}?.dataset.status === 'waiting-text'`, 10000);
  tag = await tagOf();
  check('waiting-text → tag "À tua espera", tag-wait, EMPTY diamond (is-idle)', waited && tag.text === 'À tua espera' && tag.cls === 'tag-wait' && tag.icon === 'state-icon is-idle', JSON.stringify(tag));
  check('waiting-text: no "precisa de ti" banner over the package', await page.evaluate(`![...document.querySelectorAll('.status-banner')].some((b) => b.innerText.includes('precisa de ti'))`));
  const idle = await page.evaluate(`(() => { const e = ${statusTag}.querySelector('.state-icon'); const s = getComputedStyle(e); return { bg: s.backgroundColor, border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor }; })()`);
  check('the empty diamond is an outline in the wait colour (no fill)', /rgba\(0, 0, 0, 0\)|transparent/.test(idle.bg) && idle.border.includes('solid') && idle.border.includes('rgb(255, 183, 85)'), JSON.stringify(idle));

  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
