// Minimal CDP driver for browser checks: the installed Chrome, headless, over the DevTools WebSocket —
// Node 24's global WebSocket and fetch, no dependencies. Prove by DOM + API, never by screenshot
// (docs/skills/references/testing-and-verification.md).
//
//   import { readInstance, openBrowser, checker, login } from './cdp.mjs';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = process.env.CHROME_BIN ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The instance.json written by `instance.mjs start` (default run dir of port 7498). */
export function readInstance(dir = join(tmpdir(), 'wfa-verify-7498')) {
  return JSON.parse(readFileSync(join(resolve(dir), 'instance.json'), 'utf8'));
}

/** PASS/FAIL lines, and the exit code at the end: 0 all passed, 1 some failed. */
export function checker() {
  const results = [];
  return {
    check(name, ok, detail = '') {
      results.push(!!ok);
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
      return !!ok;
    },
    finish() {
      const passed = results.filter(Boolean).length;
      console.log(`\n${passed}/${results.length} passed`);
      return passed === results.length ? 0 : 1;
    },
  };
}

/**
 * Launches a throwaway headless Chrome and attaches to its page. Page console errors and uncaught
 * exceptions are collected in `errors`. `close()` kills Chrome and removes its profile.
 */
export async function openBrowser({ cdpPort = 9335, width = 1600, height = 1000 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'wfa-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
    if (!target) await sleep(250);
  }
  if (!target) {
    chrome.kill();
    throw new Error(`Chrome did not expose a page on CDP port ${cdpPort}`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const errors = [];
  const handlers = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    for (const handler of handlers.get(m.method) ?? []) handler(m.params);
  });

  /** Subscribes to a CDP event (e.g. `Fetch.requestPaused` to answer an API call from the scenario). */
  const on = (method, handler) => handlers.set(method, [...(handlers.get(method) ?? []), handler]);

  const send = (method, params = {}) =>
    new Promise((ok, ko) => {
      const id = nextId++;
      pending.set(id, (m) => (m.error ? ko(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });

  /** Runs an expression in the page (promises awaited) and returns its JSON value. */
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  /** Polls an expression until truthy; false on timeout. Wait for state, never sleep blind. */
  const waitFor = async (expression, timeout = 10000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(expression).catch(() => false)) return true;
      await sleep(100);
    }
    return false;
  };

  /** Focuses a selector and types into it like a user (Input.insertText fires React's onChange). */
  const type = async (selector, text) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await send('Input.insertText', { text });
  };

  /** One key press. `modifiers`: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift. AltGr cannot be simulated over CDP. */
  const key = async (code, keyName, modifiers = 0, keyCode = keyName.length === 1 ? keyName.toUpperCase().charCodeAt(0) : 0) => {
    for (const t of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: t, code, key: keyName, modifiers, windowsVirtualKeyCode: keyCode });
  };

  /** Calls the API from inside the page, so it carries the session cookie and the page's Origin. */
  const api = (method, path, body) =>
    evaluate(
      `fetch(${JSON.stringify(`/api${path}`)}, { method: ${JSON.stringify(method)}, headers: ${body ? `{ 'content-type': 'application/json' }` : '{}'}, body: ${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))`,
    );

  const navigate = async (url) => {
    await send('Page.navigate', { url });
    await waitFor(`document.readyState === 'complete'`);
  };

  await send('Runtime.enable');
  await send('Page.enable');

  return {
    send,
    evaluate,
    waitFor,
    type,
    key,
    api,
    navigate,
    on,
    errors,
    async close() {
      ws.close();
      chrome.kill();
      await sleep(500);
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

/** The real login form, with the instance's generated credentials. True when it lands on /terminals. */
export async function login(page, instance) {
  await page.navigate(`${instance.base}/login`);
  await page.waitFor(`!!document.querySelector('input[autocomplete="current-password"]')`);
  await page.type('input[autocomplete="username webauthn"]', instance.username);
  await page.type('input[autocomplete="current-password"]', instance.password);
  await page.evaluate(`document.querySelector('button[type="submit"]').click()`);
  return page.waitFor(`location.pathname === '/terminals'`);
}
