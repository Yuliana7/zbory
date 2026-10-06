import {
  MonobankError,
  createPacer,
  defaultRange,
  estimateRequests,
  fetchJarStatement,
  fetchJars,
  isUahJar,
  kyivIsoDate,
  jarGoal,
  statementItemsToRawDonations,
  updateRangeStart,
  type MonoJar,
  type MonoStatementItem,
} from '../../src/utils/monobankApi';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const DAY = 86400;
const item = (over: Partial<MonoStatementItem> & { id: string; time: number }): MonoStatementItem => ({
  description: 'Від: Тестовий Донор',
  amount: 10000,
  balance: 10000,
  ...over,
});

// ── mapping ──
const t0 = 1791291654; // 2026-10-06 13:00:54 UTC = 16:00:54 in Kyiv (summer time, UTC+3)
const rows = statementItemsToRawDonations([
  item({ id: 'a', time: t0 - 3600, amount: 20000, balance: 30000, comment: 'Дякуємо', description: 'Від: Оля' }),
  item({ id: 'b', time: t0, amount: 16650, balance: 46650, description: 'Від: 🐈' }),
  item({ id: 'c', time: t0 + 60, amount: -40000, balance: 6650, description: 'На білу картку' }),
  item({ id: 'd', time: t0 + 120, amount: 500, balance: 7150, hold: true }),
  item({ id: 'e', time: t0 + 180, amount: 0, balance: 6650 }),
]);
check('map: holds and zero amounts are skipped', rows.length === 3);
check('map: newest first', rows[0].date === '06.10.2026 16:01' && rows[2].date === '06.10.2026 15:00', rows.map((r) => r.date).join(' | '));
check('map: kopecks → hryvnia string', rows[1].amount === '166.50' && rows[1].balance === '466.50');
check('map: withdrawal is a positive "Часткове зняття" row', rows[0].category === 'Часткове зняття' && rows[0].amount === '400.00');
check('map: donation category + description + comment pass through', rows[2].category === 'За посиланням' && rows[2].additionalInfo === 'Від: Оля' && rows[2].comment === 'Дякуємо');
check('map: currency columns', rows[1].currency === 'UAH' && rows[1].balanceCurrency === 'UAH');

// ── jars ──
const jar = (over: Partial<MonoJar> = {}): MonoJar => ({ id: 'j1', sendId: 's', title: 'Тест', description: '', currencyCode: 980, balance: 0, goal: 3000000, ...over });
check('jarGoal: kopecks → hryvnia', jarGoal(jar()) === 30000);
check('jarGoal: no goal → undefined', jarGoal(jar({ goal: 0 })) === undefined);
check('isUahJar', isUahJar(jar()) && !isUahJar(jar({ currencyCode: 840 })));

// ── ranges ──
check('estimate: 1 request within 31 days', estimateRequests(0, 30 * DAY) === 1 && estimateRequests(0, 31 * DAY) === 1);
check('estimate: more windows for longer ranges', estimateRequests(0, 31 * DAY + 1) === 2 && estimateRequests(0, 90 * DAY) === 3);
const range = defaultRange(Date.UTC(2026, 9, 2, 12, 30));
check('defaultRange: last 30 days ending today', range.from === '2026-09-02' && range.to === '2026-10-02', JSON.stringify(range));
check('defaultRange: "today" is Kyiv\'s day even when it is still yesterday elsewhere', defaultRange(Date.UTC(2026, 9, 2, 22, 30)).to === '2026-10-03');
check('defaultRange: across a month boundary', JSON.stringify(defaultRange(Date.UTC(2026, 2, 1, 12, 0))) === '{"from":"2026-01-30","to":"2026-03-01"}');
check('kyivIsoDate: just after Kyiv midnight', kyivIsoDate(Date.UTC(2026, 9, 5, 21, 0, 1)) === '2026-10-06' && kyivIsoDate(Date.UTC(2026, 9, 5, 20, 59, 59)) === '2026-10-05');

// ── clock times are Kyiv time, whatever zone the device is in (the CSV is Kyiv time too) ──
const at = (unix: number) => statementItemsToRawDonations([item({ id: 'z', time: unix })])[0].date;
check('time zone: summer (UTC+3)', at(Date.UTC(2026, 6, 15, 12, 0, 0) / 1000) === '15.07.2026 15:00', at(Date.UTC(2026, 6, 15, 12, 0, 0) / 1000));
check('time zone: winter (UTC+2)', at(Date.UTC(2026, 0, 15, 12, 0, 0) / 1000) === '15.01.2026 14:00', at(Date.UTC(2026, 0, 15, 12, 0, 0) / 1000));
check('time zone: just before / after the spring change (03:00 → 04:00)', at(Date.UTC(2026, 2, 29, 0, 59, 0) / 1000) === '29.03.2026 02:59' && at(Date.UTC(2026, 2, 29, 1, 0, 0) / 1000) === '29.03.2026 04:00');
check('time zone: just before / after the autumn change (04:00 → 03:00)', at(Date.UTC(2026, 9, 25, 0, 59, 0) / 1000) === '25.10.2026 03:59' && at(Date.UTC(2026, 9, 25, 1, 0, 0) / 1000) === '25.10.2026 03:00');
check('time zone: midnight rolls the date over in Kyiv', at(Date.UTC(2026, 9, 5, 21, 0, 0) / 1000) === '06.10.2026 00:00');

// ── date ranges are cut on Kyiv days ──
check('day start: Kyiv midnight in summer', dayStartSec('2026-10-06') === Date.UTC(2026, 9, 5, 21, 0, 0) / 1000);
check('day start: Kyiv midnight in winter', dayStartSec('2026-01-15') === Date.UTC(2026, 0, 14, 22, 0, 0) / 1000);
const far = Date.UTC(2030, 0, 1) / 1000;
check('day end: 23:59:59 Kyiv time', dayEndSec('2026-10-06', far) === Date.UTC(2026, 9, 6, 20, 59, 59) / 1000);
check('day end: never later than now', dayEndSec('2026-10-06', 1_000) === 1_000);
check('day length across the spring change is 23 h', dayEndSec('2026-03-29', far) + 1 - dayStartSec('2026-03-29') === 23 * 3600);
check('day length across the autumn change is 25 h', dayEndSec('2026-10-25', far) + 1 - dayStartSec('2026-10-25') === 25 * 3600);
check(
  'updateRangeStart: day of the newest row',
  updateRangeStart([
    { date: '10.03.2026 10:00', category: '', amount: '1', currency: '', additionalInfo: '', comment: '', balance: '', balanceCurrency: '' },
    { date: '15.03.2026 11:05', category: '', amount: '1', currency: '', additionalInfo: '', comment: '', balance: '', balanceCurrency: '' },
  ]) === '2026-03-15',
);
check('updateRangeStart: nothing to go on', updateRangeStart([]) === null);

// ── fetching: fetch, sleep and the clock are injected, so waits run on virtual time ──
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const makeDeps = (responder: (url: string, n: number) => Response | Promise<Response>) => {
  const calls: Array<{ url: string; token: string | null; at: number }> = [];
  let clock = 1_000_000; // virtual ms
  let slept = 0;
  const deps = {
    fetch: (async (url: string, init?: RequestInit) => {
      calls.push({ url, token: new Headers(init?.headers).get('X-Token'), at: clock });
      return responder(url, calls.length);
    }) as unknown as typeof fetch,
    sleep: async (ms: number) => {
      slept += ms;
      clock += ms;
    },
    now: () => clock,
    pacer: createPacer(), // fresh rate-limit memory per scenario
  };
  return {
    calls,
    deps,
    get slept() {
      return slept;
    },
    /** time passes with no requests (e.g. the user is choosing a jar) */
    idle: (ms: number) => {
      clock += ms;
    },
  };
};
const kindOf = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return 'none';
  } catch (e) {
    return e instanceof MonobankError ? e.kind : 'other';
  }
};

(async () => {
  // one window: no waiting, token sent as a header, jar id used as the account
  let m = makeDeps(() => json([item({ id: 'x1', time: 1000 })]));
  let got = await fetchJarStatement({ token: ' tok ', jarId: 'JAR/1', fromSec: 1000 - DAY, toSec: 1000 + DAY, deps: m.deps });
  check('fetch: single request for a short range, no waiting', m.calls.length === 1 && m.slept === 0);
  check('fetch: token header trimmed, jar id in the path', m.calls[0].token === 'tok' && m.calls[0].url.includes('/personal/statement/JAR%2F1/'));
  check('fetch: returns the items', got.length === 1 && got[0].id === 'x1');

  // 70 days = 3 windows, each request ≥61 s after the previous one, countdown reported
  const progress: Array<{ done: number; total: number; waitSeconds: number }> = [];
  m = makeDeps((_u, n) => json([item({ id: `w${n}`, time: n })]));
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: 70 * DAY, onProgress: (p) => progress.push(p), deps: m.deps });
  check('fetch: 70 days → 3 windows', m.calls.length === 3 && got.length === 3);
  check('fetch: requests are at least 61 s apart', m.calls.slice(1).every((c, i) => c.at - m.calls[i].at >= 61_000));
  check('fetch: waits 61 s between requests, not before the first', m.slept === 2 * 61_000);
  check('fetch: windows are ≤31 days and contiguous', (() => {
    const spans = m.calls.map((c) => c.url.split('/').slice(-2).map(Number));
    return spans.every(([f, t]) => t - f <= 31 * DAY) && spans[0][0] === spans[1][1] && spans[2][0] === 0 && spans[0][1] === 70 * DAY;
  })());
  check('fetch: countdown is reported', progress.some((p) => p.waitSeconds === 61) && progress.some((p) => p.waitSeconds === 1) && progress.at(-1)!.done === 3);

  // the docs give the limit per function: a statement right after the jar list needs no wait
  m = makeDeps((url) => (url.endsWith('/client-info') ? json({ jars: [] }) : json([item({ id: 's', time: 5 })])));
  await fetchJars('t', { deps: m.deps });
  check('limit: the jar list itself goes out immediately', m.slept === 0);
  m.idle(5_000); // the user is picking a jar
  const quickWaits: number[] = [];
  await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, onProgress: (p) => p.waitSeconds > 0 && quickWaits.push(p.waitSeconds), deps: m.deps });
  check('limit: a statement right after the jar list does not wait', m.slept === 0 && quickWaits.length === 0 && m.calls.length === 2, `slept ${m.slept}`);

  // …but if Monobank does count them together, its 429 is waited out and retried
  m = makeDeps((url, n) => (n === 2 ? json({}, 429) : url.endsWith('/client-info') ? json({ jars: [] }) : json([item({ id: 's2', time: 5 })])));
  await fetchJars('t', { deps: m.deps });
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, deps: m.deps });
  check('limit: a 429 after the jar list is waited out, then the statement succeeds', m.calls.length === 3 && got.length === 1 && m.slept === 61_000);

  // the same endpoint twice in a row does wait
  m = makeDeps(() => json({ jars: [] }));
  await fetchJars('t', { deps: m.deps });
  const jarWaits: number[] = [];
  await fetchJars('t', { deps: m.deps, onWait: (sec) => jarWaits.push(sec) });
  check('limit: a second jar-list request waits a full window', m.slept === 61_000 && jarWaits[0] === 61);

  m = makeDeps(() => json([item({ id: 'z', time: 9 })]));
  await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, deps: m.deps });
  m.idle(20_000);
  const repeatWaits: number[] = [];
  await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, onProgress: (p) => p.waitSeconds > 0 && repeatWaits.push(p.waitSeconds), deps: m.deps });
  check('limit: a repeated statement waits only the remaining 41 s', m.slept === 41_000 && repeatWaits[0] === 41 && repeatWaits.at(-1) === 1, `slept ${m.slept}`);

  m = makeDeps(() => json({ jars: [] }));
  await fetchJars('t', { deps: m.deps });
  m.idle(61_000);
  await fetchJars('t', { deps: m.deps });
  check('limit: no wait once a full window has passed', m.slept === 0);

  // a dropped connection never reached Monobank, so the retry is immediate
  m = makeDeps((_u, n) => { if (n === 1) throw new TypeError('Failed to fetch'); return json({ jars: [] }); });
  check('limit: dropped connection → network', (await kindOf(() => fetchJars('t', { deps: m.deps }))) === 'network');
  await fetchJars('t', { deps: m.deps });
  check('limit: a dropped connection does not make the retry wait', m.slept === 0 && m.calls.length === 2);

  // a rejected token doesn't use up the window, so fixing a typo is instant
  m = makeDeps((_u, n) => (n === 1 ? json({ errorDescription: "Unknown 'X-Token'" }, 403) : json({ jars: [] })));
  check('limit: 403 → invalid-token', (await kindOf(() => fetchJars('typo', { deps: m.deps }))) === 'invalid-token');
  await fetchJars('right', { deps: m.deps });
  check('limit: a rejected token does not make the next try wait', m.slept === 0 && m.calls.length === 2);

  // a full page (500) is continued from its oldest item; the boundary item is de-duplicated
  const page = Array.from({ length: 500 }, (_, i) => item({ id: `p${i}`, time: 5000 - i })); // 5000 … 4501
  m = makeDeps((_u, n) => (n === 1 ? json(page) : json([item({ id: 'p499', time: 4501 }), item({ id: 'old', time: 4000 })])));
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 3000, toSec: 5000, deps: m.deps });
  check('fetch: full page triggers a follow-up request from the oldest item', m.calls.length === 2 && m.calls[1].url.endsWith('/3000/4501'), m.calls[1]?.url);
  check('fetch: the follow-up is also paced', m.slept === 61_000);
  check('fetch: boundary item de-duplicated, newest first', got.length === 501 && got[0].id === 'p0' && got.at(-1)!.id === 'old');

  // errors
  m = makeDeps(() => { throw new TypeError('Failed to fetch'); });
  check('error: fetch failure → network', (await kindOf(() => fetchJars('t', { deps: m.deps }))) === 'network');

  m = makeDeps(() => json({}, 500));
  check('error: 500 → unexpected', (await kindOf(() => fetchJars('t', { deps: m.deps }))) === 'unexpected');

  // 429: the retry waits a full window (the rejected request still counted)
  m = makeDeps((_u, n) => (n === 1 ? json({}, 429) : json([item({ id: 'r', time: 10 })])));
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, deps: m.deps });
  check('429: waits a minute, retries, succeeds', m.calls.length === 2 && got.length === 1 && m.slept === 61_000);

  m = makeDeps(() => json({}, 429));
  check('429: gives up after a few retries', (await kindOf(() => fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, deps: m.deps }))) === 'rate-limit' && m.calls.length === 4 && m.slept === 3 * 61_000);

  // jars: no jars key is fine
  m = makeDeps(() => json({ clientId: 'c', accounts: [] }));
  check('jars: missing array → empty list', (await fetchJars('t', { deps: m.deps })).length === 0);

  // cancel while waiting
  m = makeDeps(() => json([item({ id: 'c', time: 1 })]));
  const abort = new AbortController();
  let aborted = false;
  try {
    await fetchJarStatement({
      token: 't', jarId: 'j', fromSec: 0, toSec: 40 * DAY, signal: abort.signal,
      deps: { ...m.deps, sleep: async () => { abort.abort(); throw new DOMException('Aborted', 'AbortError'); } },
    });
  } catch (e) { aborted = e instanceof DOMException && e.name === 'AbortError'; }
  check('cancel: an abort while waiting propagates', aborted);

  console.log(failures === 0 ? '\nAll monobank API checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
