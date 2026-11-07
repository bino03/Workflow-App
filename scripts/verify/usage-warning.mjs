// The quota limit warning (5 h at 90% and 100%, weekly at 90%): the instance's usage.json is written by hand,
// the way the status line would, and each page load reads it. Proves by DOM + localStorage that the modal only
// closes with OK, comes back neither after a reload nor on another page, and that a reset window never warns. The OK
// is kept per account (ADR 0027): an OK on one account does not silence the other, the old format (no account) is read
// as the primary's, and expired OKs — of removed accounts too — are pruned when a new one is stored.
//
//   node scripts/verify/instance.mjs start --fresh
//   node scripts/verify/usage-warning.mjs [run dir]
//   node scripts/verify/instance.mjs stop --clean
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checker, login, openBrowser, readInstance, sleep } from './cdp.mjs';

const instance = readInstance(process.argv[2]);
const { check, finish } = checker();
const page = await openBrowser();

const inHours = (hours) => Math.floor(Date.now() / 1000 + hours * 3600);
const fiveHourReset = inHours(2);
const weeklyReset = inHours(72);

// The quota file of an account: `usage.json` for the primary, `usage-<id>.json` for the others.
function writeUsage(fiveHourPct, weeklyPct, fiveHourResetsAt = fiveHourReset, fileName = 'usage.json') {
  const data = {
    rate_limits: {
      five_hour: { used_percentage: fiveHourPct, resets_at: fiveHourResetsAt },
      seven_day: { used_percentage: weeklyPct, resets_at: weeklyReset },
    },
    fetchedAt: new Date().toISOString(),
  };
  writeFileSync(join(instance.dataDir, fileName), JSON.stringify(data));
}

const KEY = 'workflow-app.usage-warnings';
const stored = async () => JSON.parse((await page.evaluate(`localStorage.getItem('${KEY}')`)) ?? '{}');
const warningKey = `document.querySelector('[data-usage-warning]')?.getAttribute('data-usage-warning') ?? null`;
// The body stays in the DOM after closing (hidden): visible = no display:none ancestor.
const modalOpen = `document.querySelector('[data-usage-warning]')?.offsetParent != null`;

async function load(path = '/terminals') {
  await page.navigate(`${instance.base}${path}`);
  // The provider polls on mount: wait for /api/usage to have been answered (the sidebar or the modal shows it).
  await sleep(1500);
}

async function clickOk() {
  await page.evaluate(`[...document.querySelectorAll('.ant-modal-footer button')].find((b) => b.textContent.trim() === 'OK').click()`);
  return page.waitFor(`!(${modalOpen})`);
}

try {
  check('login', await login(page, instance));

  writeUsage(50, 40);
  await load();
  check('below 90%: no warning', !(await page.evaluate(modalOpen)));

  writeUsage(92, 40);
  await load();
  check('5 h at 92%: the warning opens', await page.waitFor(modalOpen), String(await page.evaluate(warningKey)));
  check('it is the 5 h 90% warning', (await page.evaluate(warningKey)) === 'fiveHour90');
  const sidebar = await page.evaluate(`document.querySelector('[data-quota="sidebar"]')?.innerText ?? ''`);
  check('the terminals sidebar reads the same shared poll', /92%/.test(sidebar), sidebar.replace(/\n/g, ' | '));
  const text = await page.evaluate(`document.querySelector('.ant-modal-container').innerText`);
  check('shows the percentage and the reset time', /92% usado/.test(text) && /repõe/.test(text), text.replace(/\n/g, ' | '));
  check('no close button (✕)', !(await page.evaluate(`!!document.querySelector('.ant-modal-close')`)));
  check('OK has the focus', await page.waitFor(`document.activeElement?.textContent?.trim() === 'OK'`));

  await page.key('Escape', 'Escape', 0, 27);
  await sleep(400);
  check('Esc does not close it', await page.evaluate(modalOpen));

  for (const t of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type: t, x: 8, y: 500, button: 'left', clickCount: 1 });
  await sleep(400);
  check('a click outside does not close it', await page.evaluate(modalOpen));

  check('OK closes it', await clickOk());
  const afterOk = await stored();
  check('the OK is stored under the account, with the window reset', afterOk.primary?.fiveHour90 === new Date(fiveHourReset * 1000).toISOString(), JSON.stringify(afterOk));

  await load();
  check('same window after a reload: no warning', !(await page.evaluate(modalOpen)));
  await load('/library');
  check('same window on another page: no warning', !(await page.evaluate(modalOpen)));

  writeUsage(95, 40, fiveHourReset + 7);
  await load('/library');
  check('resetsAt a few seconds off: still the same window, no warning', !(await page.evaluate(modalOpen)));

  writeUsage(100, 40);
  await load('/library');
  check('5 h at 100%: the second warning opens on /library', await page.waitFor(modalOpen));
  check('it is the 100% warning', (await page.evaluate(warningKey)) === 'fiveHour100');
  check('title says the window is exhausted', /Esgotaste/.test(await page.evaluate(`document.querySelector('.ant-modal-title').innerText`)));
  check('OK closes it', await clickOk());

  writeUsage(100, 93);
  await load();
  check('weekly at 93%: its own warning', await page.waitFor(modalOpen));
  check('it is the weekly warning', (await page.evaluate(warningKey)) === 'weekly90');
  check('OK closes it', await clickOk());
  await load();
  check('all acknowledged: no warning after a reload', !(await page.evaluate(modalOpen)));

  // The next 5 h window: the stored OK belonged to a reset that has passed.
  await page.evaluate(
    `localStorage.setItem('workflow-app.usage-warnings', JSON.stringify({ primary: { ...JSON.parse(localStorage.getItem('workflow-app.usage-warnings')).primary, fiveHour90: new Date(Date.now() - 60000).toISOString(), fiveHour100: new Date(Date.now() - 60000).toISOString() } }))`,
  );
  writeUsage(91, 93);
  await load();
  check('next window at 91%: warns again', await page.waitFor(modalOpen));
  check('the 5 h 90% warning again', (await page.evaluate(warningKey)) === 'fiveHour90');
  await clickOk();

  // The old format (before accounts): the top-level keys are the primary's, so a window already acknowledged stays so.
  await page.evaluate(`localStorage.setItem('${KEY}', JSON.stringify({ fiveHour90: '${new Date(fiveHourReset * 1000).toISOString()}' }))`);
  writeUsage(92, 40);
  await load();
  check('old format: read as the one of the primary, no warning', !(await page.evaluate(modalOpen)));

  // Two accounts: an OK on one does not silence the other.
  await page.evaluate(`localStorage.removeItem('${KEY}')`);
  const extra = (await page.api('POST', '/accounts', { label: 'Conta B' })).body;
  check('the second account is created', typeof extra?.id === 'string', JSON.stringify(extra));
  writeUsage(92, 40);
  await load();
  check('primary at 92%: warns', await page.waitFor(modalOpen));
  check('OK closes it', await clickOk());

  writeUsage(92, 40, fiveHourReset, `usage-${extra.id}.json`);
  const activated = await page.api('PUT', '/accounts/active', { accountId: extra.id });
  check('the second account is now active', activated.body?.activeAccountId === extra.id, JSON.stringify(activated.body));
  await load();
  check('same 92% on the other account: warns again', await page.waitFor(modalOpen));
  check('OK closes it', await clickOk());
  const both = await stored();
  check('both accounts have their OK', Boolean(both.primary?.fiveHour90 && both[extra.id]?.fiveHour90), JSON.stringify(both));
  await load();
  check('the second account, acknowledged: no warning after a reload', !(await page.evaluate(modalOpen)));

  await page.api('PUT', '/accounts/active', { accountId: 'primary' });
  await load();
  check('back on the primary: its own OK still holds, no warning', !(await page.evaluate(modalOpen)));

  // An expired OK — of an account that no longer exists — is pruned when the next one is stored.
  await page.api('PUT', '/accounts/active', { accountId: extra.id });
  await page.evaluate(
    `localStorage.setItem('${KEY}', JSON.stringify({ ...JSON.parse(localStorage.getItem('${KEY}')), gone: { fiveHour90: new Date(Date.now() - 60000).toISOString() } }))`,
  );
  writeUsage(92, 93, fiveHourReset, `usage-${extra.id}.json`);
  await load();
  check('weekly 93% on the second account: warns', await page.waitFor(modalOpen));
  check('OK closes it', await clickOk());
  const pruned = await stored();
  check('the expired OK of a missing account is pruned', !('gone' in pruned) && Boolean(pruned.primary), JSON.stringify(pruned));

  await page.api('PUT', '/accounts/active', { accountId: 'primary' });
  await page.evaluate(`localStorage.removeItem('${KEY}')`);
  writeUsage(99, 50, inHours(-1));
  await load();
  check('a window already reset never warns', !(await page.evaluate(modalOpen)));

  check('no console errors', page.errors.length === 0, page.errors.join(' | '));
} catch (error) {
  check('scenario ran to the end', false, error.message);
} finally {
  await page.close();
}
process.exit(finish());
