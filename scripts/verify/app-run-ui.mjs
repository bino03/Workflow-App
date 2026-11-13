// Correr / Parar in the Terminais header (spec docs/features/correr-a-app.md, steps 5-6): the same header in focus
// and grid, the control only for a project with the run + stop skills, the six states, the port links, the time
// going up without a new poll, Ver terminal, and the control kept with an enlarged terminal.
// idle / unavailable / the real errors come from the instance's backend; the instance's `claude` has no login and
// never runs a /run, so the running states are the backend's answers replayed by the scenario (Fetch.requestPaused).
// The real /run → /stop goes in step 8, on a real project.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/app-run-ui.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const BETA = instance.projects.Beta;
const size = { cols: 80, rows: 24 };
for (const skill of ['run', 'stop']) {
  mkdirSync(join(BETA, '.claude', 'skills', skill), { recursive: true });
  writeFileSync(join(BETA, '.claude', 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
}

const header = `document.querySelector('[data-terminals-header]')`;
const control = `${header}.querySelector('[data-app-run-phase]')`;
const phaseIs = (phase) => `${control}?.dataset.appRunPhase === ${JSON.stringify(phase)}`;
const controlText = `(${control}?.innerText ?? '').replace(/\\s+/g, ' ').trim()`;
const picker = `${header}.querySelector('[aria-label="Estilo de grelha"]')`;
const button = (name) => `${control}?.querySelector('[data-app-run="${name}"]')`;
const sidebarItem = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const toast = `document.querySelector('.ant-notification-notice')?.innerText ?? ''`;

// Replayed answers: while `fake` is set, GET /api/app-runs answers it; POST /reveal answers `revealId`.
let fake = null;
let revealId = null;
const gets = { count: 0 };
const view = (over) => ({ path: BETA, phase: 'idle', unavailableReason: null, terminalId: null, startedAt: null, runningSince: null, ports: [], error: null, ...over });
const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const trace = [];
const t0 = Date.now();
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const url = new URL(request.url);
  trace.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${request.method} ${url.pathname}${fake ? ' (fake ' + fake.phase + ')' : ''}`);
  const fulfill = (body) =>
    page.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: json(body) });
  if (request.method === 'GET' && url.pathname === '/api/app-runs' && fake && url.searchParams.get('path') === BETA) {
    gets.count++;
    return void fulfill(fake);
  }
  if (request.method === 'POST' && url.pathname === '/api/app-runs/reveal' && revealId) return void fulfill({ terminalId: revealId });
  return void page.send('Fetch.continueRequest', { requestId });
});

const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;
const headerLine = async () => page.evaluate(`[...${header}.children].slice(0, 2).map((e) => e.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')`);

try {
  check('login', await login(page, instance));
  const alfa = await create(ALFA, 'Alfa um');
  const beta = await create(BETA, 'Beta um');
  const beta2 = await create(BETA, 'Beta dois');
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/app-runs*', requestStage: 'Request' }] });
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${sidebarItem(beta.id)}`);

  // ── Focus mode (the default) ──
  await page.evaluate(`${sidebarItem(beta.id)}.click()`);
  check('focus: the common header is there', await page.waitFor(`!!${header} && /2 abertos/.test(${header}.innerText)`));
  const focusLine = await headerLine();
  check('focus: no grid style picker', !(await page.evaluate(`!!${picker}`)));
  check('focus: Beta (run + stop) shows Correr', await page.waitFor(`${phaseIs('idle')} && !!${button('start')}`));

  await page.evaluate(`${button('start')}.click()`);
  check('Correr in a folder claude does not trust yet → the TERMINAL_007 message', await page.waitFor(`/confiança/.test(${toast})`), await page.evaluate(toast));
  check('… and stays at Correr', await page.evaluate(phaseIs('idle')));

  await page.evaluate(`${sidebarItem(alfa.id)}.click()`);
  check('Alfa (no skills): the header has no control', await page.waitFor(`/1 abertos/.test(${header}.innerText) && !${control}`));
  const real = await page.api('GET', `/app-runs?path=${encodeURIComponent(ALFA)}`);
  check('… because the backend says missing-skills', real.body?.unavailableReason === 'missing-skills', JSON.stringify(real.body));

  await page.evaluate(`${sidebarItem(beta.id)}.click()`);
  await page.waitFor(phaseIs('idle'));

  // ── The states, from the backend's answers ──
  fake = view({ phase: 'starting', terminalId: 'run-1', startedAt: new Date().toISOString() });
  check('starting: arc + "A arrancar…" + Parar', await page.waitFor(`${phaseIs('starting')} && ${controlText}.startsWith('A arrancar…') && !!${control}.querySelector('.state-icon.is-work') && !!${button('stop')}`, 15000));

  const since = new Date(Date.now() - 12 * 60_000 + 8_000).toISOString(); // 11 min 52 s ago
  fake = view({ phase: 'running', terminalId: 'run-1', startedAt: since, runningSince: since, ports: [5173, 7400] });
  check('running: dot + "A correr · 11 min · :5173, :7400"', await page.waitFor(`${phaseIs('running')} && /^A correr · 11 min · :5173,\\s?:7400/.test(${controlText}) && !!${control}.querySelector('.state-icon.is-run')`, 10000), await page.evaluate(controlText));
  check('running: the ports are links to localhost', await page.evaluate(`[...${control}.querySelectorAll('a[data-app-run-port]')].map((a) => a.href + ' ' + a.target).join() === 'http://localhost:5173/ _blank,http://localhost:7400/ _blank'`));
  check('running: Parar is enabled', await page.evaluate(`!${button('stop')}.disabled`));
  const pollsBefore = gets.count;
  check('the time goes up by itself (11 → 12 min)', await page.waitFor(`/^A correr · 12 min/.test(${controlText})`, 25000), await page.evaluate(controlText));
  check('… with the same answer from the backend', gets.count >= pollsBefore);

  fake = view({ phase: 'running', terminalId: 'run-1', startedAt: since, runningSince: new Date(Date.now() - 65 * 60_000 - 30_000).toISOString(), ports: [5173] }); // the clock ticks every 15 s
  check('over an hour: "1 h 05 min"', await page.waitFor(`/^A correr · 1 h 05 min · :5173 Parar$/.test(${controlText})`, 10000), await page.evaluate(controlText));

  fake = view({ phase: 'stopping', terminalId: 'run-1', startedAt: since, runningSince: since, ports: [5173] });
  check('stopping: "A parar…" and Parar disabled', await page.waitFor(`${phaseIs('stopping')} && ${controlText}.startsWith('A parar…') && ${button('stop')}.disabled`, 10000));

  fake = view({ phase: 'failed', terminalId: beta2.id, startedAt: since, error: 'no-port' });
  check('failed (no-port): ✕ "Não arrancou" + Ver terminal + Correr', await page.waitFor(`${phaseIs('failed')} && ${controlText}.startsWith('Não arrancou') && !!${control}.querySelector('.state-icon.is-err') && !!${button('reveal')} && !!${button('start')}`, 15000));
  check('… in the error colour', await page.evaluate(`getComputedStyle(${control}.querySelector('span')).color === getComputedStyle(document.documentElement).getPropertyValue('--wfa-state-err').trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => 'rgb(' + [r, g, b].map((h) => parseInt(h, 16)).join(', ') + ')')`));

  fake = view({ phase: 'failed', terminalId: beta2.id, startedAt: since, error: 'ports-gone' });
  check('failed (ports-gone): "Parou sozinha"', await page.waitFor(`${controlText}.startsWith('Parou sozinha')`, 15000));

  // ── Grid ──
  await page.evaluate(`localStorage.setItem('workflow-app.layout', 'grid'); window.dispatchEvent(new Event('workflow-app:layout'))`);
  check('grid: the grid is there', await page.waitFor(`!!document.querySelector('[data-terminal-grid]')`));
  check('grid: the same header line as in focus', (await headerLine()) === focusLine, `${await headerLine()} vs ${focusLine}`);
  check('grid: control to the left of the style picker', await page.evaluate(`!!${picker} && (${control}.compareDocumentPosition(${picker}) & Node.DOCUMENT_POSITION_FOLLOWING) > 0`));

  revealId = beta2.id;
  await page.evaluate(`${button('reveal')}.click()`);
  check('Ver terminal: its terminal is shown, enlarged', await page.waitFor(`${pane(beta2.id)}?.checkVisibility() && !${pane(beta.id)}.checkVisibility()`, 10000));
  check('enlarged: the control stays, the style picker goes', await page.evaluate(`!!${control} && !${picker}`));

  fake = null;
  const getsBefore = gets.count;
  const backToIdle = await page.waitFor(phaseIs('idle'), 15000);
  const why = backToIdle ? '' : `${await page.evaluate(controlText).catch(String)} · replayed GETs after fake=null: ${gets.count - getsBefore} · visibility ${await page.evaluate('document.visibilityState').catch(String)} · trace: ${trace.slice(-4).join('; ')} · real now: ${JSON.stringify((await page.api('GET', `/app-runs?path=${encodeURIComponent(BETA)}`)).body?.phase)} · 12 s later: ${(await page.waitFor(phaseIs('idle'), 12000)) ? 'idle' : await page.evaluate(controlText)}`;
  check('the real backend again: Correr', backToIdle, why);
  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
await sleep(0);
process.exit(finish());
