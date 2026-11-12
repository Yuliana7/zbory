import type { OwnJar } from '../../src/types';
import { addOwnJar, applyOwnRead, goalPct, isOwnJar, ownJarAggregates, ownJarLink, ownJarsStale, renewOwnJars, restoreOwnJars, listOwnJars, sortOwnJars } from '../../src/utils/ownJars';
import { buildBackup, parseBackup } from '../../src/utils/campaignStore';
import { JAR_LOOKUP_URL } from '../../src/utils/monobankJar';
import { offeredFor } from '../../src/utils/templateConfig';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const NOW = new Date(2026, 10, 12, 15, 0).getTime();
const DAY = 864e5;
// made-up ids only: the repo is public
const L = (c: string) => `Long${c.repeat(28)}`;

// what the fake Monobank and our fake lookup know
const lookups: Record<string, { longId: string; mainJar?: string }> = {
  MyJar001: { longId: L('a'), mainJar: 'MainJar01' },
  MyJar002: { longId: L('b'), mainJar: 'MainJar01' },
  MainJar01: { longId: L('m') },
  Plain0001: { longId: L('p') },
};
const reads: Record<string, Record<string, unknown>> = {
  [L('a')]: { amount: 123400, goal: 500000, title: 'На FPV від Олі', ownerName: 'Оля', currency: 980, closed: false, jarId: 'MyJar001' },
  [L('b')]: { amount: 50000, goal: 0, title: 'Друга', ownerName: 'Оля', currency: 980, closed: false, jarId: 'MyJar002' },
  [L('m')]: { amount: 4000000, goal: 10000000, title: 'Тепловізор для бригади', ownerName: 'Фонд', currency: 980, closed: false, jarId: 'MainJar01' },
  [L('p')]: { amount: 1000, goal: 0, title: 'Звичайна', ownerName: 'Оля', currency: 980, closed: false, jarId: 'Plain0001' },
};
const calls: string[] = [];
let throttle = new Set<string>();
const fetcher = (async (url: string) => {
  const u = String(url);
  const id = decodeURIComponent(u.split('/').pop()!);
  calls.push(u.startsWith(JAR_LOOKUP_URL) ? `lookup:${id}` : `read:${id}`);
  if (throttle.has(id)) return new Response('{}', { status: 429 });
  const body = u.startsWith(JAR_LOOKUP_URL) ? lookups[id] : reads[id];
  return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('{}', { status: 404 });
}) as unknown as typeof fetch;

(async () => {
  // ── adding ──
  const added = await addOwnJar('https://send.monobank.ua/jar/MyJar001', [], { fetch: fetcher, now: NOW });
  check('add by link: added', 'jar' in added);
  const jar = (added as { jar: OwnJar }).jar;
  check('add by link: title, amount, goal, ids', jar.name === 'На FPV від Олі' && jar.raised === 1234 && jar.target === 5000 && jar.jarId === L('a') && jar.shortId === 'MyJar001');
  check('add by link: the main jar is read too', jar.main?.shortId === 'MainJar01' && jar.main.longId === L('m') && jar.main.title === 'Тепловізор для бригади' && jar.main.raised === 40000 && jar.main.goal === 100000 && jar.main.ownerName === 'Фонд');
  check('add by link: history starts on the day it was added', jar.history?.length === 1 && jar.history[0].at === NOW && jar.history[0].raised === 1234);
  check('add by link: stamped', jar.addedAt === NOW && jar.syncedAt === NOW && jar.updatedAt === NOW);
  check('add: valid record', isOwnJar(jar));

  calls.length = 0;
  const byLong = await addOwnJar(L('b'), [jar], { fetch: fetcher, now: NOW });
  const jarB = (byLong as { jar: OwnJar }).jar;
  check('add by long id: reads the jar, then finds its main jar by the short id', calls.join() === `read:${L('b')},lookup:MyJar002,lookup:MainJar01,read:${L('m')}` && jarB.main?.title === 'Тепловізор для бригади');
  check('add by long id: no goal → no target', jarB.target === undefined);

  const dup = await addOwnJar('send.monobank.ua/jar/MyJar001', [jar], { fetch: fetcher });
  check('add: the same jar twice is refused', 'error' in dup && dup.error === 'duplicate');
  const bad = await addOwnJar('hello', [], { fetch: fetcher });
  check('add: not a link', 'error' in bad && bad.error === 'invalid');
  const missing = await addOwnJar('https://send.monobank.ua/jar/Nope00001', [], { fetch: fetcher });
  check('add: unknown jar', 'error' in missing && missing.error === 'not-found');
  const plain = (await addOwnJar('https://send.monobank.ua/jar/Plain0001', [], { fetch: fetcher, now: NOW })) as { jar: OwnJar };
  check('add: a jar that feeds nothing is kept, without a main jar', plain.jar && plain.jar.main === undefined);

  throttle = new Set(['MainJar01']);
  const mainFails = (await addOwnJar('https://send.monobank.ua/jar/MyJar002', [], { fetch: fetcher, now: NOW })) as { jar: OwnJar };
  check('add: the main jar failing still adds the jar, keeping the main short id', mainFails.jar?.main?.shortId === 'MainJar01' && mainFails.jar.main.title === undefined);
  throttle = new Set();

  // ── renewing ──
  reads[L('a')] = { ...reads[L('a')], amount: 200000 };
  reads[L('m')] = { ...reads[L('m')], amount: 5000000 };
  const closed: OwnJar = { ...jarB, id: 'closed', jarId: L('c'), closed: true };
  const unresolved: OwnJar = { ...mainFails.jar, id: 'unres' };
  calls.length = 0;
  const later = NOW + DAY;
  const r = await renewOwnJars([jar, closed, unresolved], { fetch: fetcher, now: () => later, sleep: async () => {} });
  const by = (id: string) => r.jars.find((j) => j.id === id)!;
  check('renew: a main jar fed by two jars is read once', calls.filter((c) => c === `read:${L('m')}`).length === 1);
  check('renew: a main jar whose long id another jar knows is not looked up', !calls.includes('lookup:MainJar01'));
  // its main jar may still get fresh numbers when an open jar feeds the same one: that read is made anyway
  check('renew: closed jars are not read', !calls.includes(`read:${L('c')}`) && by('closed').raised === closed.raised && by('closed').syncedAt === closed.syncedAt);
  check('renew: new amounts for the jar and its main jar', by(jar.id).raised === 2000 && by(jar.id).main?.raised === 50000 && by('unres').main?.raised === 50000 && by('unres').main?.longId === L('m'));
  check('renew: history gets a point on a new day', by(jar.id).history?.length === 2 && by(jar.id).history![1].raised === 2000);
  check('renew: updatedAt moves only on a change', by(jar.id).updatedAt === later && by('unres').updatedAt === mainFails.jar.updatedAt);
  check('renew: the input jars are left as they were', jar.raised === 1234 && unresolved.main?.longId === undefined);
  check('renew: no failures', r.failed === 0 && !r.rateLimited);

  calls.length = 0;
  const alone = await renewOwnJars([unresolved], { fetch: fetcher, now: () => later, sleep: async () => {} });
  check('renew: a main jar without a long id is looked up first', calls[0] === 'lookup:MainJar01' && alone.jars[0].main?.longId === L('m') && alone.jars[0].main.title === 'Тепловізор для бригади');

  throttle = new Set([L('a')]);
  const r2 = await renewOwnJars([jar], { fetch: fetcher, now: () => later, sleep: async () => {} });
  check('renew: still throttled after the retry → reported, jar kept', r2.rateLimited && r2.failed === 1 && r2.firstError === 'rate-limit' && r2.jars[0].raised === 1234);
  throttle = new Set();

  // ── reads ──
  const kept = applyOwnRead({ ...jar, name: 'Моя назва' }, { title: '', ownerName: '', raised: 10, goal: undefined, closed: true, shortId: undefined }, later);
  check('read: empty title keeps the old one; closed and short id carried', kept.name === 'Моя назва' && kept.closed === true && kept.shortId === 'MyJar001' && kept.target === undefined);

  // ── helpers ──
  check('stale: never read or older than 15 min; closed never', ownJarsStale([{ ...jar, syncedAt: NOW }], NOW + 60_000) === false && ownJarsStale([{ ...jar, syncedAt: NOW - DAY }], NOW) && !ownJarsStale([{ ...jar, closed: true, syncedAt: 0 }], NOW));
  check('sort: open first, newest added first', sortOwnJars([{ ...jar, id: 'old', addedAt: 1 }, { ...jar, id: 'cl', closed: true, addedAt: 9 }, { ...jar, id: 'new', addedAt: 5 }]).map((j) => j.id).join() === 'new,old,cl');
  check('goal %: rounded down, null without a goal', goalPct(999, 1000) === 99 && goalPct(1500, 1000) === 150 && goalPct(5, undefined) === null && goalPct(5, 0) === null);
  check('card link: without the scheme', ownJarLink('MyJar001') === 'send.monobank.ua/jar/MyJar001');

  const agg = ownJarAggregates({ ...jar, history: [{ at: NOW - 3 * DAY, raised: 1 }], syncedAt: NOW }, NOW);
  check('aggregates: the total, no donations', agg.totalAmount === 1234 && agg.donationCount === 0 && agg.medianDonation === 0 && agg.topDonors.length === 0);
  check('aggregates: dates from the first record to the last read', agg.firstDate.getTime() === NOW - 3 * DAY && agg.lastDate.getTime() === NOW);

  // ── templates ──
  check('templates: a jar gets only its own set', offeredFor('friendly-jar', true) && offeredFor('urgency', true) && !offeredFor('top-donors', true) && !offeredFor('daily-activity', true));
  check('templates: a project never gets the jar card', !offeredFor('friendly-jar', false) && offeredFor('top-donors', false));

  // ── backup ──
  const first = await restoreOwnJars([jar, { ...jarB, id: 'b2' }]);
  check('restore: new jars are added', first.added === 2 && (await listOwnJars()).length === 2);
  const again = await restoreOwnJars([jar, { ...jar, id: 'b2', jarId: jarB.jarId, addedAt: jarB.addedAt, syncedAt: NOW + 5 * DAY }]);
  check('restore: same is kept, newer replaces', again.kept === 1 && again.updated === 1);
  const backup = await buildBackup(NOW);
  check('backup: carries the jars', backup.ownJars?.length === 2);
  check('backup: reads back', parseBackup(JSON.stringify(backup))?.ownJars?.length === 2);
  const { ownJars: _drop, ...older } = backup;
  void _drop;
  check('backup: an older file without jars still reads', parseBackup(JSON.stringify(older)) !== null);
  check('backup: a broken jar list is refused', parseBackup(JSON.stringify({ ...backup, ownJars: [{ id: 1 }] })) === null);

  console.log(failures === 0 ? '\nAll own jar checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
