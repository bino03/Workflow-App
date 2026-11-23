// Session events channel (ADR 0038): the state a hook writes reaches the page through /api/terminals/events/ws, with
// no GET /api/terminals in between. The instance's `claude` has no login, so the scenario writes what the session hook
// would (DATA_DIR/session-state/<id>/state.json and agents/*.json, atomically) — the real fs.watch → TerminalEvents →
// socket → useTerminals path runs, only the hook itself is replaced. Proof by DOM (state icons, agent sub-lines) and
// by the network (CDP Network domain: the socket opened, no list request while the events arrive, one on reconnect).
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/session-events.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, openProject, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const size = { cols: 80, rows: 24 };
const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;
const item = (id) => `document.querySelector('[data-terminal-item="${id}"]')`;
const iconCls = (id) => `${item(id)}?.querySelector('[data-state-icon] .state-icon')?.className.replace('state-icon ', '')`;
const subs = (id) => `[...${item(id)}.parentElement.querySelectorAll('[data-agent-subline]')].length`;

// What the session hook (backend/src/terminals/sessionState.ts) writes: tmp + rename.
const stateDir = (id) => join(instance.dataDir, 'session-state', id);
function writeAtomic(file, body) {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(`${file}.999.tmp`, JSON.stringify(body));
  renameSync(`${file}.999.tmp`, file);
}
const hookState = (id, activity, event) => writeAtomic(join(stateDir(id), 'state.json'), { activity, event, at: new Date().toISOString() });
const hookAgent = (id, agentId, kind, body = {}) => writeAtomic(join(stateDir(id), 'agents', `${agentId}.${kind}.json`), { ...body, at: new Date().toISOString() });

// ── The network: the events socket and every GET of the list ──
const sockets = [];
let listGets = 0;
page.on('Network.webSocketCreated', ({ url }) => sockets.push(url));
page.on('Network.requestWillBeSent', ({ request }) => {
  if (request.method === 'GET' && new URL(request.url).pathname === '/api/terminals') listGets++;
});

/** Time from the hook's write until the DOM shows it; null if it never does. */
async function timed(write, expression, timeout = 5000) {
  const start = Date.now();
  write();
  return (await page.waitFor(expression, timeout)) ? Date.now() - start : null;
}

try {
  await page.send('Network.enable');
  // Keeps a handle on every socket the page opens, to drop the events one by hand (a backend restart, seen from the page).
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__sockets = []; const W = window.WebSocket; window.WebSocket = class extends W { constructor(...a) { super(...a); window.__sockets.push(this); } };`,
  });
  check('login', await login(page, instance));
  const a1 = await create(ALFA, 'Alfa um');
  const a2 = await create(ALFA, 'Alfa dois');
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!document.querySelector('[data-terminal-pane]')`, 15000);
  await openProject(page, ALFA);
  await page.waitFor(`!!${item(a1.id)} && !!${item(a2.id)}`, 8000);
  // window.__sockets is per document: the login page that landed on /terminals had its own, gone with the navigate.
  check('one events socket in this page, open, on /api/terminals/events/ws', await page.waitFor(`window.__sockets.filter((s) => s.url.endsWith('/api/terminals/events/ws')).length === 1 && window.__sockets.find((s) => s.url.endsWith('/api/terminals/events/ws')).readyState === 1`, 5000), sockets.join(' '));
  // The PTY's TUI may still be starting: let its own hooks (if any) settle before the clock starts.
  await sleep(1500);

  listGets = 0;
  const t1 = await timed(() => hookState(a1.id, 'needs-you', 'PermissionRequest'), `${iconCls(a1.id)} === 'is-wait'`);
  check('needs-you written by the "hook" → solid diamond in the sidebar, under 2 s', t1 !== null && t1 < 2000, `${t1} ms`);
  const t2 = await timed(() => hookState(a1.id, 'working', 'PostToolUse'), `${iconCls(a1.id)} === 'is-work'`);
  check('working → the arc, under 2 s', t2 !== null && t2 < 2000, `${t2} ms`);
  const t3 = await timed(() => hookState(a2.id, 'needs-you', 'PermissionRequest'), `${iconCls(a2.id)} === 'is-wait'`);
  check('the other terminal (was waiting): needs-you → solid diamond, under 2 s', t3 !== null && t3 < 2000, `${t3} ms`);
  const t4 = await timed(() => {
    hookAgent(a1.id, 'agent-1', 'start', { type: 'Explore' });
    hookAgent(a1.id, 'agent-1', 'info', { description: 'Procurar o gateway', type: 'Explore', model: 'claude-sonnet-5-5' });
  }, `${subs(a1.id)} === 1`);
  check('an agent starts → one sub-line under A1, under 2 s', t4 !== null && t4 < 2000, `${t4} ms`);
  const t5 = await timed(() => hookAgent(a1.id, 'agent-1', 'stop'), `${subs(a1.id)} === 0`);
  check('the agent stops → the sub-line goes, under 2 s', t5 !== null && t5 < 2000, `${t5} ms`);
  check('none of that asked for the list (no GET /api/terminals)', listGets === 0, `${listGets} GETs`);
  check('A2 untouched by A1\'s events', (await page.evaluate(iconCls(a2.id))) === 'is-wait');

  // ── The socket drops (a backend restart, from the page's side): it comes back and rereads the list once ──
  listGets = 0;
  await page.evaluate(`window.__sockets.find((s) => s.url.endsWith('/api/terminals/events/ws') && s.readyState === 1).close()`);
  const back = await page.waitFor(`window.__sockets.filter((s) => s.url.endsWith('/api/terminals/events/ws')).length === 2 && window.__sockets.at(-1).readyState === 1`, 8000);
  check('after a drop the page opens a new events socket', back);
  check('…and rereads the list on reconnect (it may have missed events)', await page.waitFor(`true`, 1000).then(() => listGets >= 1), `${listGets} GETs`);
  const t6 = await timed(() => hookState(a1.id, 'needs-you', 'PermissionRequest'), `${iconCls(a1.id)} === 'is-wait'`);
  check('the new socket delivers too', t6 !== null && t6 < 2000, `${t6} ms`);

  // ── Close a terminal: its folder goes, nothing breaks ──
  rmSync(stateDir(a2.id), { recursive: true, force: true });
  await sleep(500);
  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
