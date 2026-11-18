// "Continuar no Claude app" on the Novo projeto page (ADR 0033): the button only in waiting-text (tooltip otherwise),
// the modal with the session's name, Esconder aqui → the notice instead of the conversation, Mostrar a conversa ↔
// Esconder aqui, the "No Claude app" banner (also for needs-you, instead of "Ver terminal"), the permission decided in
// the app labelled as such, the end panels as always, and the GUIDED_005 message.
//
// The instance's `claude` has no login, so a real guided session dies at once: the creation is the scenario's,
// answered over CDP (Fetch.requestPaused on /api/creations/current and /api/guided/*). Every request the page makes
// to change it (POST /remote, PUT /display) is recorded and checked. The backend side is covered by its tests.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/guided-claude-app.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2] || undefined);
const { check, finish } = checker();
const page = await openBrowser();

const ID = '6f0f5a7e-0000-4000-8000-000000000001';
const AT = '2026-11-18T10:00:00.000Z';
let view = { id: ID, purpose: 'create', status: 'working', terminalId: ID, createdAt: AT, mode: 'ask', remote: false, display: null, pending: null, result: null, error: null };
const entries = [
  { id: 'brief', type: 'user-text', text: 'Uma app para as reservas do ginásio.', at: AT },
  { id: 'a1', type: 'assistant-text', markdown: 'Qual é o nome do projeto?', at: AT },
  { id: 'u1', type: 'user-text', text: 'teste', at: AT },
  { id: 'p1', type: 'permission', summary: 'Write: C:\\p\\answers.txt', decision: 'allow', at: AT, outside: true },
];
const sent = [];
let failRemote = false;

const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const url = new URL(request.url);
  const fulfill = (body, responseCode = 200) =>
    page.send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: json(body) });
  if (url.pathname === '/api/creations/current') return void fulfill(view);
  if (url.pathname === `/api/guided/${ID}` && request.method === 'GET') return void fulfill(view);
  if (url.pathname === `/api/guided/${ID}/feed`) {
    const after = Number(url.searchParams.get('after') ?? 0);
    return void fulfill({ entries: entries.slice(Math.max(0, Math.min(after, entries.length) - 1)), cursor: String(entries.length) });
  }
  if (url.pathname === `/api/guided/${ID}/remote` && request.method === 'POST') {
    const body = JSON.parse(request.postData ?? '{}');
    sent.push(['POST remote', body]);
    if (failRemote) return void fulfill({ errorCode: 'GUIDED_005', message: 'The guided session is already in the Claude app' }, 409);
    view = { ...view, remote: true, display: body.display, status: 'working' };
    return void fulfill(view);
  }
  if (url.pathname === `/api/guided/${ID}/display` && request.method === 'PUT') {
    const body = JSON.parse(request.postData ?? '{}');
    sent.push(['PUT display', body]);
    view = { ...view, display: body.display };
    return void fulfill(view);
  }
  return void page.send('Fetch.continueRequest', { requestId });
});

const headerButton = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const modal = `[...document.querySelectorAll('.ant-modal')].find((m) => m.checkVisibility() && m.textContent.includes('Continuar no Claude app'))`;
const modalButton = (label) => `[...(${modal}?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const notice = `document.querySelector('[data-in-app-notice]')`;
const banner = `document.querySelector('[data-in-app-banner]')`;
const feed = `document.querySelector('[role="log"]')`;
const bodyText = `document.body.innerText`;
const set = async (over, settle = 2500) => {
  view = { ...view, ...over };
  await sleep(settle); // the page polls every 1.5 s
};

try {
  check('login', await login(page, instance));
  await page.send('Fetch.enable', {
    patterns: [
      { urlPattern: '*/api/creations/current*', requestStage: 'Request' },
      { urlPattern: `*/api/guided/${ID}*`, requestStage: 'Request' },
    ],
  });
  await page.navigate(`${instance.base}/new-project`);
  check('the creation is on the page', await page.waitFor(`${bodyText}.includes('A criar o projeto') && ${bodyText}.includes('Qual é o nome do projeto?')`, 8000));

  // 1. Working → the button is there but disabled, and the tooltip says why.
  check('the button shows while working', await page.waitFor(`!!${headerButton('Continuar no Claude app')}`));
  check('and it is disabled', await page.evaluate(`${headerButton('Continuar no Claude app')}.disabled === true`));
  // A real pointer: antd's Tooltip listens on the wrapper of a disabled button, and synthetic events do not reach it.
  const box = await page.evaluate(`(() => { const r = ${headerButton('Continuar no Claude app')}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  check('the tooltip explains it', await page.waitFor(`[...document.querySelectorAll('.ant-tooltip')].some((t) => t.checkVisibility() && t.textContent.includes('Só quando o Claude está à espera do teu texto'))`, 4000));
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });

  // 2. Waiting for text → enabled; the modal names the session; Cancelar sends nothing.
  await set({ status: 'waiting-text' });
  check('waiting-text: the button is enabled', await page.waitFor(`${headerButton('Continuar no Claude app')}?.disabled === false`));
  await page.evaluate(`${headerButton('Continuar no Claude app')}.click()`);
  check('the modal opens with the session name', await page.waitFor(`!!${modal} && ${modal}.textContent.includes('Novo projeto · create')`));
  check('it offers Esconder aqui and Manter aberto', await page.evaluate(`!!${modalButton('Esconder aqui')} && !!${modalButton('Manter aberto')}`));
  await page.evaluate(`${modalButton('Cancelar')}.click()`);
  await sleep(500);
  check('Cancelar closes it and sends nothing', !(await page.evaluate(`!!${modal}`)) && sent.length === 0, JSON.stringify(sent));

  // 3. A refusal from the backend shows its message (GUIDED_005).
  failRemote = true;
  await page.evaluate(`${headerButton('Continuar no Claude app')}.click()`);
  await page.waitFor(`!!${modal}`);
  await page.evaluate(`${modalButton('Esconder aqui')}.click()`);
  check('GUIDED_005 shows its message', await page.waitFor(`[...document.querySelectorAll('.ant-notification-notice')].some((n) => n.textContent.includes('Esta criação já está no Claude app.'))`, 4000));
  failRemote = false;
  sent.length = 0;
  await page.evaluate(`document.querySelectorAll('.ant-notification-notice-close').forEach((b) => b.click())`);
  if (!(await page.evaluate(`!!${modal}`))) {
    await page.evaluate(`${headerButton('Continuar no Claude app')}.click()`);
    await page.waitFor(`!!${modal}`);
  }

  // 4. Esconder aqui → POST {display: hidden}; the notice replaces the conversation; the header keeps its controls.
  await page.evaluate(`${modalButton('Esconder aqui')}.click()`);
  check('POST /remote with display hidden', await page.waitFor(`true`) && (await (async () => { for (let i = 0; i < 30 && sent.length === 0; i++) await sleep(100); return sent.length === 1 && sent[0][0] === 'POST remote' && sent[0][1].display === 'hidden'; })()), JSON.stringify(sent));
  check('the modal closes', await page.waitFor(`!${modal}`));
  check('the notice: "A responder no Claude app" and the terminal in the background', await page.waitFor(`!!${notice} && ${notice}.textContent.includes('A responder no Claude app') && ${notice}.textContent.includes('terminal a correr em fundo')`));
  check('the conversation is hidden', await page.evaluate(`!${feed}`));
  check('the header says "No Claude app" and the button is gone', await page.evaluate(`!!document.querySelector('[data-in-app-tag]') && !${headerButton('Continuar no Claude app')}`));
  check('the header keeps Permissões, Ver terminal and Cancelar', await page.evaluate(`!!document.querySelector('[aria-label="Permissões"]') && !!${headerButton('Ver terminal')} && !!${headerButton('Cancelar')}`));

  // 5. Mostrar a conversa → PUT {display: open}; the feed, the banner, the permission decided in the app.
  await page.evaluate(`[...${notice}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Mostrar a conversa').click()`);
  check('PUT /display open', await (async () => { for (let i = 0; i < 30 && sent.length < 2; i++) await sleep(100); return sent[1]?.[0] === 'PUT display' && sent[1][1].display === 'open'; })(), JSON.stringify(sent));
  check('the conversation is back, with the banner', await page.waitFor(`!!${feed} && !!${banner} && ${banner}.textContent.includes('respondem-se lá')`));
  check('the message typed in the app is in the feed', await page.evaluate(`${feed}.textContent.includes('teste')`));
  check('the permission approved there says "no Claude app"', await page.evaluate(`[...${feed}.querySelectorAll('.feed-line')].some((l) => l.textContent.includes('Permitido') && l.textContent.includes('no Claude app') && l.textContent.includes('answers.txt'))`));

  // 6. needs-you in the app: the banner says it waits there — not "Ver terminal".
  await set({ status: 'needs-you' });
  check('needs-you: the banner points to the app', await page.waitFor(`!!${banner} && ${banner}.textContent.includes('à tua espera lá')`));
  check('and not "a sessão precisa de algo que esta vista não mostra"', await page.evaluate(`!${bodyText}.includes('esta vista não mostra')`));

  // 7. waiting-text, Manter aberto: the reply box is there too.
  await set({ status: 'waiting-text' });
  check('waiting-text: the reply box stays', await page.waitFor(`!!document.querySelector('[data-reply-dock] textarea')`));

  // 8. Esconder aqui from the banner → PUT {display: hidden}.
  await page.evaluate(`[...${banner}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Esconder aqui').click()`);
  check('PUT /display hidden', await (async () => { for (let i = 0; i < 30 && sent.length < 3; i++) await sleep(100); return sent[2]?.[0] === 'PUT display' && sent[2][1].display === 'hidden'; })(), JSON.stringify(sent));
  check('the notice is back', await page.waitFor(`!!${notice} && !${feed}`));

  // 9. Done (hidden): the end panel, as always. The page stops polling at the end, so the next state is a reload.
  await set({ status: 'done', result: { version: 1, status: 'done', projectPath: 'C:\\p\\Ginasio', projectName: 'Ginasio', summary: 'Feito.', openDecisions: [], nextStep: null, error: null } });
  check('done: "Projeto criado" with Abrir projeto', await page.waitFor(`${bodyText}.includes('Projeto criado') && !!${headerButton('Abrir projeto')} && !${notice}`));

  // 10. Stopped (the backend restarted): Retomar shows — the notice does not hide it.
  view = { ...view, status: 'stopped', result: null };
  await page.navigate(`${instance.base}/new-project`);
  check('stopped: Retomar shows, the notice goes', await page.waitFor(`!!${headerButton('Retomar')} && !${notice}`, 8000));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.stack ?? error.message);
} finally {
  await page.close();
}
process.exit(finish());
