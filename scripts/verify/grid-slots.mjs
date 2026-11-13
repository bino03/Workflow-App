// A new terminal takes the first empty place of the grid (spec estilos-de-grelha §2, revised 2026-11-13): in a
// style with places and a free one, the "+" of the project in the sidebar puts it there without enlarging; a full
// grid enlarges it as before; a place whose terminal was closed counts as free; classic still enlarges.
// Confirmed on the DOM (which panes are visible) and on the saved preference (localStorage).
//
//   cd frontend && npm run build && cd ..
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/grid-slots.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { checker, login, openBrowser, readInstance } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const ALFA = instance.projects.Alfa;
const size = { cols: 80, rows: 24 };
const KEY = `workflow-app.grid-layout.${ALFA}`;

const pane = (id) => `document.querySelector('[data-terminal-pane="${id}"]')`;
const visible = async (id) => page.evaluate(`!!${pane(id)} && ${pane(id)}.checkVisibility()`);
const slots = async () => page.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) ?? 'null')?.slotIds ?? null`);
const alfaIds = async () => (await page.api('GET', '/terminals')).body.filter((t) => t.cwd === ALFA).map((t) => t.id);
const plus = `document.querySelector('[aria-label="Novo terminal em Alfa"]')`;

/** Clicks the sidebar "+" of Alfa and returns the id of the terminal it opened. */
async function newFromSidebar() {
  const before = await alfaIds();
  await page.waitFor(`!!${plus} && !${plus}.disabled && !${plus}.classList.contains('ant-btn-loading')`);
  await page.evaluate(`${plus}.click()`);
  await page.waitFor(`fetch('/api/terminals').then((r) => r.json()).then((l) => l.filter((t) => t.cwd === ${JSON.stringify(ALFA)}).length === ${before.length + 1})`, 15000);
  const id = (await alfaIds()).find((x) => !before.includes(x));
  await page.waitFor(`!!${pane(id)}`, 10000);
  await page.waitFor(`!${plus}.classList.contains('ant-btn-loading')`, 10000);
  return id;
}

async function openWith(style, slotIds) {
  await page.evaluate(`localStorage.setItem('workflow-app.layout', 'grid'); localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify({ gridStyle: style, slotIds }))})`);
  await page.navigate(`${instance.base}/terminals`);
  await page.waitFor(`!!${plus}`);
}

try {
  check('login', await login(page, instance));
  const a = (await page.api('POST', '/terminals', { cwd: ALFA, mode: 'new', label: 'A', ...size })).body;
  const b = (await page.api('POST', '/terminals', { cwd: ALFA, mode: 'new', label: 'B', ...size })).body;

  // 2×2 with two terminals: the "+" of the sidebar fills the 3rd place, without enlarging.
  await openWith({ kind: 'quad' }, [a.id, b.id, null, null]);
  await page.waitFor(`${pane(a.id)}?.checkVisibility() && ${pane(b.id)}?.checkVisibility()`);
  const c = await newFromSidebar();
  check('2×2: the new terminal takes the 3rd place', JSON.stringify(await slots()) === JSON.stringify([a.id, b.id, c, null]), JSON.stringify(await slots()));
  check('…and nothing is enlarged: A, B and the new one are all on screen', (await visible(a.id)) && (await visible(b.id)) && (await visible(c)));
  check(
    '…and it has the keyboard (the only tile with the accent border)',
    await page.waitFor(
      `[...document.querySelectorAll('[data-terminal-pane].border-accent')].map((e) => e.dataset.terminalPane).join() === ${JSON.stringify(c)}`,
      3000,
    ),
  );

  const d = await newFromSidebar();
  check('the next one takes the 4th place', JSON.stringify(await slots()) === JSON.stringify([a.id, b.id, c, d]));
  check('…four on screen', (await visible(a.id)) && (await visible(b.id)) && (await visible(c)) && (await visible(d)));

  // Full grid: as before — enlarged, places unchanged.
  const e = await newFromSidebar();
  check('full grid: the places do not change', JSON.stringify(await slots()) === JSON.stringify([a.id, b.id, c, d]));
  check('…and the new one is enlarged (alone on screen)', (await visible(e)) && !(await visible(a.id)) && !(await visible(d)));

  // A closed terminal's place counts as free: the next new one goes there (the grid never fills by itself).
  await page.api('DELETE', `/terminals/${b.id}`);
  await openWith({ kind: 'quad' }, [a.id, b.id, c, d]);
  await page.waitFor(`${pane(a.id)}?.checkVisibility()`);
  check('closing B leaves its place empty (nothing moves in by itself)', !(await page.evaluate(`!!${pane(e)}?.checkVisibility()`)));
  const f = await newFromSidebar();
  check("the next new one takes B's old place", JSON.stringify(await slots()) === JSON.stringify([a.id, f, c, d]), JSON.stringify(await slots()));
  check('…without enlarging', (await visible(a.id)) && (await visible(f)) && (await visible(c)) && (await visible(d)));

  // Classic (3×2) has no places: unchanged, it enlarges.
  await openWith({ kind: 'classic' }, []);
  const g = await newFromSidebar();
  check('classic: the new one is enlarged, as before', (await visible(g)) && !(await visible(a.id)));
  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
