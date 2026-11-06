import type { FriendJar } from '../../src/types';
import { friendsToCSV, nextHistory } from '../../src/utils/friendJars';
import { dataAsOf, formatWhen, linkedOpen, refreshSavedFriends, staleFriends } from '../../src/utils/friendsRefresh';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const NOW = new Date(2026, 9, 20, 15, 0).getTime();
const MIN = 60_000;
const J = (c: string) => c.repeat(16);

const friends: FriendJar[] = [
  { id: 'a', name: 'Анна', raised: 100, target: 2000, jarId: J('A'), syncedAt: NOW - 60 * MIN, updatedAt: NOW - 90 * MIN },
  { id: 'b', name: 'Богдан', raised: 50, jarId: J('B'), syncedAt: NOW - 2 * MIN, updatedAt: NOW - 90 * MIN },
  { id: 'c', name: 'Closed', raised: 300, jarId: J('C'), closed: true, syncedAt: NOW - 600 * MIN },
  { id: 'd', name: 'Ручна', raised: 10 },
  { id: 'e', name: 'Ева', raised: 70, jarId: J('E') }, // never read
];

// ── who gets read ──
check('linkedOpen: linked and not closed', linkedOpen(friends).map((f) => f.id).join() === 'a,b,e');
check('stale: older than 15 min or never read (closed / unlinked never)', staleFriends(friends, NOW).map((f) => f.id).join() === 'a,e');
check('asOf: unknown while one linked jar was never read', dataAsOf(friends) === undefined);
check('asOf: the oldest read among linked open jars', dataAsOf(friends.filter((f) => f.id !== 'e')) === NOW - 60 * MIN);
check('asOf: no linked jars → undefined', dataAsOf([friends[3]]) === undefined);
check('when: today / other day', formatWhen(NOW - 30 * MIN, NOW) === 'сьогодні 14:30' && formatWhen(new Date(2026, 9, 18, 9, 5).getTime(), NOW) === '18.10 09:05');

// ── reading ──
const sleeps: number[] = [];
const sleep = async (ms: number) => void sleeps.push(ms);
const calls: string[] = [];
const jars: Record<string, unknown> = {
  [J('A')]: { amount: 150000, goal: 500000, title: 'T-A', ownerName: 'O', currency: 980, closed: false }, // 1500 raised
  [J('B')]: { amount: 5000, goal: 0, title: 'T-B', ownerName: 'O', currency: 980, closed: false }, // unchanged: 50
  [J('E')]: { amount: 20000, goal: 100000, title: 'T-E', ownerName: 'O', currency: 980, closed: true }, // closed now
};
const fetcher = (async (url: string) => {
  const id = decodeURIComponent(String(url).split('/').pop()!);
  calls.push(id);
  return new Response(JSON.stringify(jars[id]), { status: 200 });
}) as unknown as typeof fetch;
const progress: Array<[number, number]> = [];

(async () => {
  const r = await refreshSavedFriends(friends, { fetch: fetcher, sleep, now: () => NOW, onProgress: (p) => progress.push([p.done, p.total]) });
  const by = (id: string) => r.friends.find((f) => f.id === id)!;
  check('reads each linked open jar once, all at once with no pauses', calls.slice().sort().join() === [J('A'), J('B'), J('E')].join() && sleeps.length === 0);
  check('closed and unlinked helpers are not read', !calls.includes(J('C')));
  check('amount and status are updated', by('a').raised === 1500 && by('e').closed === true && by('e').raised === 200);
  check('typed name and target are kept; an empty target takes the jar goal', by('a').name === 'Анна' && by('a').target === 2000 && by('e').target === 1000);
  check('syncedAt is stamped on the ones that were read', by('a').syncedAt === NOW && by('b').syncedAt === NOW && by('c').syncedAt === friends[2].syncedAt);
  check('updatedAt moves only for helpers that changed', by('a').updatedAt === NOW && by('e').updatedAt === NOW && by('b').updatedAt === NOW - 90 * MIN);
  check('summary counts', r.updated === 3 && r.failed === 0 && !r.rateLimited);
  check('progress: from zero to the total', progress.length === 4 && progress[0][0] === 0 && progress[3][0] === 3);

  // only = stale ones
  calls.length = 0;
  const stale = new Set(staleFriends(friends, NOW).map((f) => f.id));
  await refreshSavedFriends(friends, { fetch: fetcher, sleep, now: () => NOW, only: (f) => stale.has(f.id) });
  check('only: limits what is read', calls.slice().sort().join() === [J('A'), J('E')].join());

  // a throttled jar is tried again after a pause; the others are kept
  const seen: Record<string, number> = {};
  const once429 = (async (url: string) => {
    const id = decodeURIComponent(String(url).split('/').pop()!);
    seen[id] = (seen[id] ?? 0) + 1;
    if (id === J('B') && seen[id] === 1) return new Response('{}', { status: 429 });
    return new Response(JSON.stringify(jars[id]), { status: 200 });
  }) as unknown as typeof fetch;
  sleeps.length = 0;
  const retried = await refreshSavedFriends(friends, { fetch: once429, sleep, now: () => NOW });
  check('429: retried after a pause, then everything is read', retried.updated === 3 && retried.failed === 0 && !retried.rateLimited && seen[J('B')] === 2 && sleeps[0] === 3000);

  // still throttled: what was read stays, the rest is reported
  const always429 = (async (url: string) => {
    const id = decodeURIComponent(String(url).split('/').pop()!);
    if (id !== J('A')) return new Response('{}', { status: 429 });
    return new Response(JSON.stringify(jars[id]), { status: 200 });
  }) as unknown as typeof fetch;
  const t = await refreshSavedFriends(friends, { fetch: always429, sleep, now: () => NOW });
  check('429 twice: flags it, keeps the result that came', t.rateLimited && t.updated === 1 && t.failed === 2 && t.friends.find((f) => f.id === 'a')!.raised === 1500);
  check('429: error kind is reported', t.firstError === 'rate-limit');

  // another failure does not stop the others
  let m = 0;
  const flaky = (async (url: string) => {
    m++;
    if (m === 1) return new Response('{}', { status: 400 });
    return new Response(JSON.stringify(jars[decodeURIComponent(String(url).split('/').pop()!)]), { status: 200 });
  }) as unknown as typeof fetch;
  const fl = await refreshSavedFriends(friends, { fetch: flaky, sleep, now: () => NOW });
  check('a not-found jar is skipped, the rest are still read', fl.failed === 1 && fl.updated === 2 && !fl.rateLimited && fl.firstError === 'not-found');

  // abort: nothing in flight is treated as a failure
  const ctl = new AbortController();
  ctl.abort();
  const aborting = (async (_url: string, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException('stop', 'AbortError');
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  const ab = await refreshSavedFriends(friends, { fetch: aborting, sleep, now: () => NOW, signal: ctl.signal });
  check('abort: no failures, the helpers stay as they were', ab.updated === 0 && ab.failed === 0 && ab.friends.find((f) => f.id === 'a')!.raised === 100);

  // ── history ──
  const DAY = 24 * 60 * MIN;
  const first = await refreshSavedFriends(friends, { fetch: fetcher, sleep, now: () => NOW });
  const hA = first.friends.find((f) => f.id === 'a')!.history!;
  check('history: starts from the known amount, then the new one', hA.length === 2 && hA[0].raised === 100 && hA[0].at === NOW - 60 * MIN && hA[1].raised === 1500 && hA[1].at === NOW);
  check('history: an unchanged amount adds nothing', first.friends.find((f) => f.id === 'b')!.history!.length === 1);
  const sameDay = nextHistory(undefined, hA, 1600, NOW + 5 * MIN);
  check('history: one point a day', sameDay.length === 2 && sameDay[1].raised === 1600);
  check('history: a new day adds a point', nextHistory(undefined, sameDay, 1700, NOW + DAY).length === 3);

  // ── CSV ──
  const csv = friendsToCSV([{ id: 'x', name: 'Ім\'я "з лапками", кома', raised: 1234.5, target: 1000, jarId: J('A'), closed: true }, { id: 'y', name: 'Без цілі', raised: 10 }]);
  const lines = csv.split('\n');
  check('csv: header + one line per helper', lines.length === 3 && lines[0].startsWith('"Назва","Зібрано, ₴"'));
  check('csv: quotes doubled, amounts with 2 decimals, % and status', lines[1].startsWith('"Ім\'я ""з лапками"", кома",1234.50,1000.00,123,"Закрита","' + J('A') + '"'));
  check('csv: empty target and % when there is no target', lines[2] === '"Без цілі",10.00,,,"Відкрита","",,');

  console.log(failures === 0 ? '\nAll refresh checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
