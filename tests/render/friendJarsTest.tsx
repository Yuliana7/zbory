import { renderToStaticMarkup } from 'react-dom/server';
import '../../src/i18n';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import { cleanFriends, computeFriendStats, formatSharePct, parseAmount } from '../../src/utils/friendJars';
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
