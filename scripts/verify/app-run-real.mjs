// Step 8 of docs/features/correr-a-app.md: Correr / Parar for real — the owner's Claude Code runs a real project's
// /run in the hidden terminal and /stop stops it. Grid and focus, the port link answering, the time going up, no new
// terminal in the grid, Parar closing the port (and leaving any other app on a neighbouring port alone), a project
// whose /run is broken on purpose showing "Não arrancou" + Ver terminal, and the Workflow App itself without the
// control. Spends a little quota; takes ~6-8 min (the broken case waits for the 3-minute limit).
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh --workflow <Workflow> --real-claude --extra-root <projects folder>
//   node scripts/verify/app-run-real.mjs <run dir> <project with run+stop> <broken project (trusted or to trust)> <this repo>
//   node scripts/verify/instance.mjs stop --clean
import { execFileSync } from 'node:child_process';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const [runDir, PROJECT, BROKEN, SELF] = process.argv.slice(2);
if (!PROJECT || !BROKEN || !SELF) throw new Error('usage: app-run-real.mjs <run dir> <project> <broken project> <this repo>');
const instance = readInstance(runDir);
const { check, finish } = checker();
const page = await openBrowser();
const size = { cols: 100, rows: 30 };

const header = `document.querySelector('[data-terminals-header]')`;
const control = `${header}?.querySelector('[data-app-run-phase]')`;
const phaseIs = (phase) => `${control}?.dataset.appRunPhase === ${JSON.stringify(phase)}`;
const controlText = `(${control}?.innerText ?? '').replace(/\\s+/g, ' ').trim()`;
const button = (name) => `${control}?.querySelector('[data-app-run="${name}"]')`;
const sidebarItem = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const panes = `[...document.querySelectorAll('[data-terminal-pane]')].filter((e) => e.checkVisibility()).length`;
const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;

/** PID listening on a port (netstat), or null. */
function listener(port) {
  const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => new RegExp(`:${port}\\s.*LISTENING`).test(l));
  return line ? Number(line.trim().split(/\s+/).at(-1)) : null;
}
async function answers(port) {
  try {
    return (await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(5000) })).ok;
  } catch {
    return false;
  }
}
const appRun = async (path) => (await page.api('GET', `/app-runs?path=${encodeURIComponent(path)}`)).body;
const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;

/** Keys to a terminal through its WebSocket (the trust dialog of a folder never seen). */
async function sendKeys(id, chunks) {
  return page.evaluate(`new Promise((done) => {
    const socket = new WebSocket(location.origin.replace('http', 'ws') + '/api/terminals/${id}/ws');
    socket.binaryType = 'arraybuffer';
    const chunks = ${JSON.stringify(chunks)};
    socket.onopen = async () => {
      for (const c of chunks) { await new Promise((r) => setTimeout(r, 700)); socket.send(new TextEncoder().encode(c)); }
      setTimeout(() => { socket.close(); done(true); }, 500);
    };
    socket.onerror = () => done(false);
  })`);
}

async function openTab(terminalId, layout) {
  await page.evaluate(`localStorage.setItem('workflow-app.layout', ${JSON.stringify(layout)})`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${sidebarItem(terminalId)}`, 15000);
  await page.evaluate(`${sidebarItem(terminalId)}.click()`);
  await page.waitFor(`!!${pane(terminalId)}`, 10000);
}

const otherVite = listener(5173); // the owner's other Vite, if any — /stop must leave it alone
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

try {
  check('login', await login(page, instance));
  const main = await create(PROJECT, 'Projeto real');
  await openTab(main.id, 'grid');
  check('grid: the control shows Correr for a project with run + stop', await page.waitFor(`${phaseIs('idle')} && !!${button('start')}`, 15000));
  const panesBefore = await page.evaluate(panes);
  const listedBefore = (await page.api('GET', '/terminals')).body.length;

  // Correr → A arrancar… → A correr · <time> · :<port>
  await page.evaluate(`${button('start')}.click()`);
  check('Correr → "A arrancar…"', await page.waitFor(`${phaseIs('starting')} && ${controlText}.includes('A arrancar')`, 10000), await page.evaluate(controlText));
  const running = await page.waitFor(phaseIs('running'), 200000);
  console.log(`  ${at()} running: ${await page.evaluate(controlText)}`);
  check('…then "A correr" (the real /run opened a port)', running, JSON.stringify(await appRun(PROJECT)));
  const view = await appRun(PROJECT);
  const port = view.ports?.[0];
  check('the port is a link to http://localhost:<port>', await page.evaluate(`${control}.querySelector('a[data-app-run-port="${port}"]')?.href === 'http://localhost:${port}/'`), `ports ${JSON.stringify(view.ports)}`);
  check('…and the app answers there', await answers(port), `port ${port}`);
  check('no new terminal in the grid nor in GET /terminals', (await page.evaluate(panes)) === panesBefore && (await page.api('GET', '/terminals')).body.length === listedBefore);
  if (otherVite) check(`the other app on :5173 (pid ${otherVite}) still listens`, listener(5173) === otherVite);

  // The time goes up: wait until a minute has passed since the port opened.
  const since = Date.parse(view.runningSince);
  await sleep(Math.max(0, since + 62_000 - Date.now()));
  check('the time goes up (≥ 1 min)', await page.waitFor(`/A correr · 1 min/.test(${controlText})`, 30000), await page.evaluate(controlText));

  // Focus mode: the same control, same state.
  await openTab(main.id, 'focus');
  check('focus: the control still says "A correr" with the port', await page.waitFor(`${phaseIs('running')} && ${controlText}.includes(':${port}')`, 15000), await page.evaluate(controlText));

  // Parar → A parar… → Correr; the port closes; the other app is untouched.
  const stopAt = Date.now();
  await page.evaluate(`${button('stop')}.click()`);
  check('Parar → "A parar…"', await page.waitFor(`${phaseIs('stopping')} && ${controlText}.includes('A parar')`, 10000), await page.evaluate(controlText));
  check('…then back to Correr', await page.waitFor(`${phaseIs('idle')} && !!${button('start')}`, 60000), await page.evaluate(controlText));
  console.log(`  ${at()} stopped in ${((Date.now() - stopAt) / 1000).toFixed(1)} s (≥ 20 s = the safety net closed it)`);
  check(`port ${port} no longer listens`, listener(port) === null);
  if (otherVite) check(`the other app on :5173 (pid ${otherVite}) was left alone`, listener(5173) === otherVite);

  // A broken /run: "Não arrancou" after the 3-minute limit, with Ver terminal.
  const broken = await create(BROKEN, 'Run partido');
  // A folder never seen: accept its trust dialog (Down, Enter) — hidden terminals need a trusted folder.
  await sleep(4000);
  await sendKeys(broken.id, ['\x1b[B', '\r']);
  await sleep(3000);
  await openTab(broken.id, 'grid');
  await page.waitFor(`${phaseIs('idle')} && !!${button('start')}`, 15000);
  await page.evaluate(`${button('start')}.click()`);
  check('broken /run: starts', await page.waitFor(phaseIs('starting'), 15000), JSON.stringify(await appRun(BROKEN)));
  const failed = await page.waitFor(phaseIs('failed'), 230000);
  console.log(`  ${at()} broken: ${await page.evaluate(controlText)}`);
  check('…"Não arrancou" (no port within 3 min)', failed && (await page.evaluate(controlText)).includes('Não arrancou'), JSON.stringify(await appRun(BROKEN)));
  check('…with Ver terminal', await page.evaluate(`!!${button('reveal')}`));
  const hiddenId = (await appRun(BROKEN)).terminalId;
  await page.evaluate(`${button('reveal')}.click()`);
  check('Ver terminal shows the hidden /run terminal', await page.waitFor(`!!${pane(hiddenId)} && ${pane(hiddenId)}.checkVisibility()`, 15000));
  await page.waitFor(`!!${button('stop')} || !!${button('start')}`, 5000);
  if (await page.evaluate(`!!${button('stop')}`)) await page.evaluate(`${button('stop')}.click()`);
  await page.waitFor(phaseIs('idle'), 40000);

  // The Workflow App itself: never the control.
  const self = await create(SELF, 'A própria app');
  await openTab(self.id, 'grid');
  await sleep(2500);
  check('the Workflow App itself has no Correr/Parar', await page.evaluate(`!!${header} && !${control}`));
  check('…and the API says why (self)', (await appRun(SELF)).unavailableReason === 'self');

  for (const t of (await page.api('GET', '/terminals')).body) await page.api('DELETE', `/terminals/${t.id}`);
  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
