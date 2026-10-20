import type { FriendJar } from '../../src/types';
import { friendsToCSV } from '../../src/utils/friendJars';
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
const progress: Array<[number, number, string | undefined]> = [];

(async () => {
  const r = await refreshSavedFriends(friends, { fetch: fetcher, sleep, now: () => NOW, onProgress: (p) => progress.push([p.done, p.total, p.current]) });
  const by = (id: string) => r.friends.find((f) => f.id === id)!;
  check('reads each linked open jar once, one pause between reads', calls.join() === [J('A'), J('B'), J('E')].join() && sleeps.length === 2 && sleeps.every((ms) => ms === 1000));
  check('closed and unlinked helpers are not read', !calls.includes(J('C')));
  check('amount and status are updated', by('a').raised === 1500 && by('e').closed === true && by('e').raised === 200);
  check('typed name and target are kept; an empty target takes the jar goal', by('a').name === 'Анна' && by('a').target === 2000 && by('e').target === 1000);
  check('syncedAt is stamped on the ones that were read', by('a').syncedAt === NOW && by('b').syncedAt === NOW && by('c').syncedAt === friends[2].syncedAt);
  check('updatedAt moves only for helpers that changed', by('a').updatedAt === NOW && by('e').updatedAt === NOW && by('b').updatedAt === NOW - 90 * MIN);
  check('summary counts', r.updated === 3 && r.failed === 0 && !r.rateLimited);
  check('progress: before each read, then total', progress.length === 4 && progress[0][2] === 'a' && progress[3][0] === 3);

  // only = stale ones
  calls.length = 0;
  const stale = new Set(staleFriends(friends, NOW).map((f) => f.id));
  await refreshSavedFriends(friends, { fetch: fetcher, sleep, now: () => NOW, only: (f) => stale.has(f.id) });
  check('only: limits what is read', calls.join() === [J('A'), J('E')].join());

  // a 429 stops the run and keeps what was read
  let n = 0;
  const throttled = (async (url: string) => {
    n++;
    if (n === 2) return new Response('{}', { status: 429 });
    return new Response(JSON.stringify(jars[decodeURIComponent(String(url).split('/').pop()!)]), { status: 200 });
  }) as unknown as typeof fetch;
  const t = await refreshSavedFriends(friends, { fetch: throttled, sleep, now: () => NOW });
  check('429: stops, flags it, keeps the first result', t.rateLimited && t.updated === 1 && t.failed === 1 && t.friends.find((f) => f.id === 'a')!.raised === 1500 && n === 2);
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

  // abort keeps what is done
  const ctl = new AbortController();
  let k = 0;
  const aborting = (async (url: string) => {
    k++;
    if (k === 1) ctl.abort();
    return new Response(JSON.stringify(jars[decodeURIComponent(String(url).split('/').pop()!)]), { status: 200 });
  }) as unknown as typeof fetch;
  const ab = await refreshSavedFriends(friends, { fetch: aborting, sleep, now: () => NOW, signal: ctl.signal });
  check('abort: stops after the read in flight, keeps it', ab.updated === 1 && k === 1);

  // ── CSV ──
  const csv = friendsToCSV([{ id: 'x', name: 'Ім\'я "з лапками", кома', raised: 1234.5, target: 1000, jarId: J('A'), closed: true }, { id: 'y', name: 'Без цілі', raised: 10 }]);
  const lines = csv.split('\n');
  check('csv: header + one line per helper', lines.length === 3 && lines[0].startsWith('"Назва","Зібрано, ₴"'));
  check('csv: quotes doubled, amounts with 2 decimals, % and status', lines[1].startsWith('"Ім\'я ""з лапками"", кома",1234.50,1000.00,123,"Закрита","' + J('A') + '"'));
  check('csv: empty target and % when there is no target', lines[2] === '"Без цілі",10.00,,,"Відкрита","",,');

  console.log(failures === 0 ? '\nAll refresh checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
