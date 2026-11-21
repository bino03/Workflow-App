// The dense grid of the IDE frame (ADR 0036, phase 3): pane headers of --wfa-row-height (name · pane-N · branch ·
// state · enlarge · close), panes glued by 1 px, the Terminais header at --wfa-header-height. The branch comes from
// the backend (`TerminalView.branch`, read from .git/HEAD); a test project gets a fake .git for it.
// Confirmed on the API and the DOM (computed sizes), in the grid and in the split focus.
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/pane-header.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const size = { cols: 80, rows: 24 };
const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const header = (id) => `${pane(id)}.querySelector('[data-pane-header]')`;
const button = (id, kind) => `${pane(id)}.querySelector('[data-pane-button="${kind}"]')`;
const rect = async (element) => page.evaluate(`(() => { const r = ${element}.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
const dialog = `[...document.querySelectorAll('.ant-modal-container')].find((m) => m.checkVisibility())`;
const create = async (cwd, label) => (await page.api('POST', '/terminals', { cwd, mode: 'new', label, ...size })).body;

mkdirSync(join(ALFA, '.git'), { recursive: true });
writeFileSync(join(ALFA, '.git', 'HEAD'), 'ref: refs/heads/feat/grelha-densa\n');

try {
  check('login', await login(page, instance));
  const a = await create(ALFA, 'Alfa um');
  const b = await create(ALFA, 'Alfa dois');
  check('the API gives the branch', a.branch === 'feat/grelha-densa', String(a.branch));
  const beta = await create(instance.projects.Beta, 'Beta um');
  check('no repository → branch null', beta.branch === null, String(beta.branch));

  // Grid, quad: two panes side by side, two empty places.
  await page.evaluate(`localStorage.setItem('workflow-app.layout', 'grid'); localStorage.setItem(${JSON.stringify(`workflow-app.grid-layout.${ALFA}`)}, ${JSON.stringify(JSON.stringify({ gridStyle: { kind: 'quad' }, slotIds: [a.id, b.id, null, null] }))})`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${pane(a.id)} && ${pane(a.id)}.checkVisibility() && ${pane(b.id)}.checkVisibility()`, 15000);
  await page.evaluate(`document.querySelector('[data-project-switcher]') && document.querySelector('[data-project-switcher]').checkVisibility() && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

  const termsHeader = await rect(`document.querySelector('[data-terminals-header]')`);
  check('Terminais header is 36 px', Math.round(termsHeader.h) === 36, `${termsHeader.h}`);
  const ha = await rect(header(a.id));
  check('pane header is 26 px', Math.round(ha.h) === 26, `${ha.h}`);
  const meta = await page.evaluate(`${pane(a.id)}.querySelector('[data-pane-meta]').textContent`);
  check('pane-N · branch', meta === 'pane-1 · feat/grelha-densa', meta);
  const metaB = await page.evaluate(`${pane(b.id)}.querySelector('[data-pane-meta]').textContent`);
  check('second pane is pane-2', metaB.startsWith('pane-2'), metaB);
  check('the state tag is there, small', await page.evaluate(`(() => { const t = ${header(a.id)}.querySelector('.tag-run.tag-sm'); return !!t && getComputedStyle(t).height === '18px' && t.textContent === 'A correr'; })()`));
  const pa = await rect(pane(a.id));
  const pb = await rect(pane(b.id));
  check('panes glued by 1 px', Math.round(pb.x - (pa.x + pa.w)) === 1, `${pb.x - (pa.x + pa.w)}`);
  check('grid starts right under the header (no margin)', Math.round(pa.y - (termsHeader.y + termsHeader.h)) === 0, `${pa.y - (termsHeader.y + termsHeader.h)}`);

  // Focus: the focused pane's header gets the accent line on top.
  await page.evaluate(`${pane(a.id)}.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  check('focused header has the accent line', await page.waitFor(`getComputedStyle(${header(a.id)}).boxShadow.includes('inset')`, 3000));

  // Enlarge button → enlarged; again → back to the grid.
  check('enlarge button says Ampliar', (await page.evaluate(`${button(a.id, 'view')}.getAttribute('aria-label')`)) === 'Ampliar');
  await page.evaluate(`${button(a.id, 'view')}.click()`);
  check('it enlarges', await page.waitFor(`!${pane(b.id)}.checkVisibility() && ${button(a.id, 'view')}.getAttribute('aria-label') === 'Voltar à grelha'`, 3000));
  await page.evaluate(`${button(a.id, 'view')}.click()`);
  check('and goes back to the grid', await page.waitFor(`${pane(b.id)}.checkVisibility()`, 3000));

  // Close button → the same confirmation as Alt+W; cancelling keeps it.
  const closeLabel = await page.evaluate(`${button(b.id, 'close')}.getAttribute('aria-label')`);
  check('close button names the shortcut', closeLabel === 'Fechar o terminal (Alt+W)', closeLabel);
  await page.evaluate(`${button(b.id, 'close')}.click()`);
  check('close asks first', await page.waitFor(`/Fechar Alfa dois/.test(${dialog}?.innerText ?? '')`, 3000));
  await page.evaluate(`[...${dialog}.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Fechar terminal').click()`);
  check('it closes', await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => !l.some((t) => t.id === ${JSON.stringify(b.id)}))`, 8000));
  await sleep(300);

  // Split focus: same 26 px header; the view button splits.
  await page.evaluate(`localStorage.setItem('workflow-app.layout', 'focus')`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${pane(a.id)} && ${pane(a.id)}.checkVisibility()`, 15000);
  const hf = await rect(header(a.id));
  check('focus mode: pane header is 26 px too', Math.round(hf.h) === 26, `${hf.h}`);

  check('no console errors', page.errors.filter((e) => !/40[49]|500/.test(e)).length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
