import { renderToStaticMarkup } from 'react-dom/server';
import '../../src/i18n';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import { cleanFriends, computeFriendStats, formatSharePct, friendBar, friendProgress, parseAmount, visibleFriends } from '../../src/utils/friendJars';
import { loadRawDonations } from './testFixture';
import { ProgressCard } from '../../src/components/templates/ProgressCard';
import { FriendsLeaderboardCard } from '../../src/components/templates/FriendsLeaderboardCard';
import { FriendsShareCard } from '../../src/components/templates/FriendsShareCard';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\u00A0/g, ' ');

// ── pure logic ──
const friends = [
  { id: 'a', name: 'Оля', raised: 300 },
  { id: 'b', name: 'Тарас', raised: 1200 },
  { id: 'c', name: 'Порожній', raised: 0 },
];
const stats = computeFriendStats(friends, 4000);
check('stats: ranked biggest first, zeros dropped', stats.ranked.map((f) => f.id).join() === 'b,a');
check('stats: total is the plain sum', stats.total === 1500);
check('stats: share = total / main', Math.abs(stats.share - 0.375) < 1e-9);
check('stats: not flagged when within the total', !stats.exceedsTotal);
check('stats: flagged when helpers exceed the jar', computeFriendStats(friends, 1000).exceedsTotal);
check('stats: share clamped to 1', computeFriendStats(friends, 1000).share === 1);
check('stats: empty/undefined is safe', computeFriendStats(undefined, 1000).total === 0 && computeFriendStats([], 0).share === 0);
check('parseAmount: spaces + comma decimal', parseAmount('1 500,50') === 1500.5);
check('parseAmount: rejects empty/zero/garbage', parseAmount('') === null && parseAmount('0') === null && parseAmount('abc') === null);
check('cleanFriends: drops blank rows, trims names', cleanFriends([{ id: 'x', name: '  ', raised: 0 }, { id: 'y', name: ' Іра ', raised: 5 }]).map((f) => f.name).join() === 'Іра');
check('formatSharePct: <1 for a sliver, not 0', formatSharePct(0.004) === '<1' && formatSharePct(0.375) === '38' && formatSharePct(0) === '0');

// ── cards ──
const { donations, withdrawals, currentBalance } = normalizeDonations(loadRawDonations('tests/data/Zbir_short.csv'));
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);
const real = [{ id: 'a', name: 'Оля з Харкова', raised: 1000 }, { id: 'b', name: 'Тарас', raised: 500 }];

let html = renderToStaticMarkup(<FriendsLeaderboardCard aggregates={aggregates} friends={real} format="post" />);
check('Leaderboard: names + amounts, biggest first', strip(html).includes('Оля з Харкова') && html.indexOf('Оля з Харкова') < html.indexOf('Тарас') && /1\s?000\s*₴/.test(strip(html)));
check('Leaderboard: total line = sum of friends', /1\s?500\s*₴/.test(strip(html)));
html = renderToStaticMarkup(<FriendsLeaderboardCard aggregates={aggregates} friends={real} format="post" hidden={new Set(['totalLine', 'header'])} />);
check('Leaderboard: removable elements', !strip(html).includes('Разом через друзів') && !strip(html).includes('Друзі збору'));
const many = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, name: `Друг ${i}`, raised: 100 + i }));
html = renderToStaticMarkup(<FriendsLeaderboardCard aggregates={aggregates} friends={many} format="story" />);
check('Leaderboard: caps rows and says how many more', strip(html).includes('+ ще 5'));

html = renderToStaticMarkup(<FriendsShareCard aggregates={aggregates} friends={real} format="post" />);
const expectPct = Math.round((1500 / aggregates.totalAmount) * 100);
check('Share: shows the share %', strip(html).includes(`${Math.min(100, expectPct)}%`), `(expected ${expectPct}%)`);
check('Share: counts friends', />2</.test(html));

// ── targets ──
const tg = [
  { id: 'a', name: 'Оля', raised: 1420, target: 1000 },
  { id: 'b', name: 'Тарас', raised: 300, target: 1000 },
  { id: 'c', name: 'Без цілі', raised: 500 },
  { id: 'd', name: 'Ще нуль', raised: 0, target: 800 },
];
check('progress: overflow keeps the real %', Math.round(friendProgress(tg[0]).pct ?? 0) === 142 && friendProgress(tg[0]).reached);
check('progress: exactly 100% is reached', friendProgress({ id: 'x', name: 'x', raised: 500, target: 500 }).reached);
check('progress: no target → null', friendProgress(tg[2]).pct === null && !friendProgress(tg[2]).reached);
const ts = computeFriendStats(tg, 10000);
check('stats: zero-raised jar with a target is listed', ts.ranked.some((f) => f.id === 'd'));
check('stats: total ignores zero jars, counts raised only', ts.total === 2220);
check('stats: reached/withTarget counts', ts.reached === 1 && ts.withTarget === 3);
const bo = friendBar(tg[0], ts.ranked);
check('bar: target mode caps fill at 1', bo.mode === 'target' && bo.fill === 1 && bo.reached);
check('bar: partial fill vs own target', Math.abs(friendBar(tg[1], ts.ranked).fill - 0.3) < 1e-9);
check('bar: no bar for target-less jar once others have targets', friendBar(tg[2], ts.ranked).mode === 'none');
check('bar: legacy relative bar when no one has a target', friendBar(friends[0], stats.ranked).mode === 'relative' && Math.abs(friendBar(friends[0], stats.ranked).fill - 0.25) < 1e-9);
check('cleanFriends: keeps a target-only row', cleanFriends([{ id: 'z', name: 'Z', raised: 0, target: 100 }]).length === 1);
check('visibleFriends: filters hidden ids', visibleFriends(ts.ranked, ['a', 'b']).map((f) => f.id).join() === 'c,d');
check('visibleFriends: undefined hides nothing', visibleFriends(ts.ranked, undefined).length === ts.ranked.length);

html = renderToStaticMarkup(<FriendsLeaderboardCard aggregates={aggregates} friends={tg} format="story" />);
check('Leaderboard: overflow shows 142%', strip(html).includes('142%'));
check('Leaderboard: ✓ only on reached jars', (html.match(/data-reached/g) ?? []).length === 1);
check('Leaderboard: reached line', strip(html).includes('Досягли цілі') && strip(html).includes('1 з 3'));
html = renderToStaticMarkup(<FriendsLeaderboardCard aggregates={aggregates} friends={tg} hiddenFriendIds={['a']} format="story" />);
check('Leaderboard: hidden jar gone, total + reached follow', !strip(html).includes('Оля') && !html.includes('data-reached') && /800\s*₴/.test(strip(html)) && strip(html).includes('0 з 2'));
html = renderToStaticMarkup(<FriendsLeaderboardCard aggregates={aggregates} friends={real} format="story" />);
check('Leaderboard: no targets → no reached line, no ✓', !html.includes('data-reached') && !strip(html).includes('Досягли цілі'));
html = renderToStaticMarkup(<FriendsShareCard aggregates={aggregates} friends={tg} format="post" />);
check('Share: counts only jars that raised something', />3</.test(html));

// ── progress line: only with friends, removable, never touches the headline total ──
const base = renderToStaticMarkup(<ProgressCard aggregates={aggregates} format="post" />);
html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} friends={real} format="post" />);
check('Progress: no friends line without friends', !strip(base).includes('через друзів'));
check('Progress: friends line present with friends', strip(html).includes('з них через друзів'));
html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} friends={real} format="post" hidden={new Set(['friendsLine'])} />);
check('Progress: friends line removable', !strip(html).includes('через друзів'));
const headline = (h: string) => strip(h).match(/Зібрано\s+([\d\s]+)/)?.[1].replace(/\s/g, '');
check('Progress: friends never change the headline total', headline(base) === headline(renderToStaticMarkup(<ProgressCard aggregates={aggregates} friends={real} format="post" />)));

console.log(failures === 0 ? '\nAll friend-jar checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
