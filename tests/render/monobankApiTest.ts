import {
  MonobankError,
  defaultRange,
  estimateRequests,
  fetchJarStatement,
  fetchJars,
  isUahJar,
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
const t0 = new Date(2026, 2, 15, 11, 5).getTime() / 1000; // 15.03.2026 11:05 local
const rows = statementItemsToRawDonations([
  item({ id: 'a', time: t0 - 3600, amount: 20000, balance: 30000, comment: 'Дякуємо', description: 'Від: Оля' }),
  item({ id: 'b', time: t0, amount: 16650, balance: 46650, description: 'Від: 🐈' }),
  item({ id: 'c', time: t0 + 60, amount: -40000, balance: 6650, description: 'На білу картку' }),
  item({ id: 'd', time: t0 + 120, amount: 500, balance: 7150, hold: true }),
  item({ id: 'e', time: t0 + 180, amount: 0, balance: 6650 }),
]);
check('map: holds and zero amounts are skipped', rows.length === 3);
check('map: newest first', rows[0].date === '15.03.2026 11:06' && rows[2].date === '15.03.2026 10:05');
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
const range = defaultRange(new Date(2026, 9, 2, 15, 30));
check('defaultRange: last 30 days ending today', range.from === '2026-09-02' && range.to === '2026-10-02', JSON.stringify(range));
check(
  'updateRangeStart: day of the newest row',
  updateRangeStart([
    { date: '10.03.2026 10:00', category: '', amount: '1', currency: '', additionalInfo: '', comment: '', balance: '', balanceCurrency: '' },
    { date: '15.03.2026 11:05', category: '', amount: '1', currency: '', additionalInfo: '', comment: '', balance: '', balanceCurrency: '' },
  ]) === '2026-03-15',
);
check('updateRangeStart: nothing to go on', updateRangeStart([]) === null);

// ── fetching (fetch + sleep injected: no network, no waiting) ──
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const makeDeps = (responder: (url: string, n: number) => Response | Promise<Response>) => {
  const calls: Array<{ url: string; token: string | null }> = [];
  let slept = 0;
  return {
    calls,
    get slept() {
      return slept;
    },
    deps: {
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url, token: new Headers(init?.headers).get('X-Token') });
        return responder(url, calls.length);
      }) as unknown as typeof fetch,
      sleep: async (ms: number) => {
        slept += ms;
      },
    },
  };
};

(async () => {
  // one window: no waiting, token sent as a header, jar id used as the account
  let m = makeDeps(() => json([item({ id: 'x1', time: 1000 })]));
  let got = await fetchJarStatement({ token: ' tok ', jarId: 'JAR/1', fromSec: 1000 - DAY, toSec: 1000 + DAY, deps: m.deps });
  check('fetch: single request for a short range', m.calls.length === 1 && m.slept === 0);
  check('fetch: token header trimmed, jar id in the path', m.calls[0].token === 'tok' && m.calls[0].url.includes('/personal/statement/JAR%2F1/'));
  check('fetch: returns the items', got.length === 1 && got[0].id === 'x1');

  // 70 days = 3 windows, 2 gaps of 61 s, each reported second by second
  const progress: Array<{ done: number; total: number; waitSeconds: number }> = [];
  m = makeDeps((_u, n) => json([item({ id: `w${n}`, time: n })]));
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: 70 * DAY, onProgress: (p) => progress.push(p), deps: m.deps });
  check('fetch: 70 days → 3 windows', m.calls.length === 3 && got.length === 3);
  check('fetch: waits 61 s between requests, not before the first', m.slept === 2 * 61_000);
  check('fetch: windows are ≤31 days and contiguous', (() => {
    const spans = m.calls.map((c) => c.url.split('/').slice(-2).map(Number));
    return spans.every(([f, t]) => t - f <= 31 * DAY) && spans[0][0] === spans[1][1] && spans[2][0] === 0 && spans[0][1] === 70 * DAY;
  })());
  check('fetch: countdown is reported', progress.some((p) => p.waitSeconds === 61) && progress.some((p) => p.waitSeconds === 1) && progress.at(-1)!.done === 3);

  // a full page (500) is continued from its oldest item; the boundary item is de-duplicated
  const page = Array.from({ length: 500 }, (_, i) => item({ id: `p${i}`, time: 5000 - i })); // 5000 … 4501
  m = makeDeps((_u, n) => (n === 1 ? json(page) : json([item({ id: 'p499', time: 4501 }), item({ id: 'old', time: 4000 })])));
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 3000, toSec: 5000, deps: m.deps });
  check('fetch: full page triggers a follow-up request from the oldest item', m.calls.length === 2 && m.calls[1].url.endsWith('/3000/4501'), m.calls[1]?.url);
  check('fetch: boundary item de-duplicated, newest first', got.length === 501 && got[0].id === 'p0' && got.at(-1)!.id === 'old');

  // errors
  m = makeDeps(() => json({ errorDescription: "Unknown 'X-Token'" }, 403));
  let kind = '';
  try { await fetchJars('bad', m.deps); } catch (e) { kind = e instanceof MonobankError ? e.kind : 'other'; }
  check('error: 403 → invalid-token', kind === 'invalid-token');

  m = makeDeps(() => { throw new TypeError('Failed to fetch'); });
  kind = '';
  try { await fetchJars('t', m.deps); } catch (e) { kind = e instanceof MonobankError ? e.kind : 'other'; }
  check('error: fetch failure → network', kind === 'network');

  m = makeDeps(() => json({}, 500));
  kind = '';
  try { await fetchJars('t', m.deps); } catch (e) { kind = e instanceof MonobankError ? e.kind : 'other'; }
  check('error: 500 → unexpected', kind === 'unexpected');

  // 429: waited out and retried
  m = makeDeps((_u, n) => (n === 1 ? json({}, 429) : json([item({ id: 'r', time: 10 })])));
  got = await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, deps: m.deps });
  check('429: waits a minute, retries, succeeds', m.calls.length === 2 && got.length === 1 && m.slept === 61_000);

  m = makeDeps(() => json({}, 429));
  kind = '';
  try { await fetchJarStatement({ token: 't', jarId: 'j', fromSec: 0, toSec: DAY, deps: m.deps }); } catch (e) { kind = e instanceof MonobankError ? e.kind : 'other'; }
  check('429: gives up after a few retries', kind === 'rate-limit' && m.calls.length === 4);

  // jars: no jars key is fine
  m = makeDeps(() => json({ clientId: 'c', accounts: [] }));
  check('jars: missing array → empty list', (await fetchJars('t', m.deps)).length === 0);

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
