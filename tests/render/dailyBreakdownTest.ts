import type { Donation, FriendJar, Withdrawal } from '../../src/types';
import { addDays, changePct, cumulativePoints, dayDetail, daysBetween, daysInRange, groupBy, groupWeeks, periodDetail, previousRange, summarize, unitsFor, weekHourGrid } from '../../src/utils/dailyBreakdown';
import { withAmountsByDay, aggregateDonations } from '../../src/utils/dataAggregator';
import { ownJarDays } from '../../src/utils/ownJars';
import { forecast, growth, jarDays, jarTimeline, leftToTarget, matchesFilter, stalledDays } from '../../src/utils/friendInsights';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const at = (d: number, h: number, m = 0) => new Date(2026, 2, d, h, m);
const don = (d: number, h: number, amount: number, donor?: string, comment?: string): Donation => ({ timestamp: at(d, h), amount, donor, comment, category: 'x' });
const donations = [don(1, 9, 100, 'Оля'), don(1, 9, 50, 'Оля', 'тримайтесь'), don(1, 20, 300), don(3, 12, 200, 'Тарас'), don(9, 10, 400)];
const withdrawals: Withdrawal[] = [{ timestamp: at(3, 18), amount: 500, balanceAfter: 0 }];

// ── days ──
const days = daysInRange(donations, withdrawals, '2026-03-01', '2026-03-09');
check('every day of the range, the empty ones too', days.length === 9 && days[1].count === 0);
check('amounts and withdrawals land on their day', days[0].amount === 450 && days[0].count === 3 && days[2].withdrawn === 500);
check('addDays crosses a month and DST', addDays('2026-03-31', 1) === '2026-04-01' && addDays('2026-03-29', 1) === '2026-03-30');
check('daysBetween counts both ends across DST', daysBetween('2026-03-28', '2026-03-30') === 3);

const weeks = groupWeeks(days);
check('weeks: seven days a bar, the rest in a short one', weeks.length === 2 && weeks[0].amount === 650 && weeks[0].endKey === '2026-03-07' && weeks[1].amount === 400 && weeks[1].endKey === '2026-03-09');

const s = summarize(days);
check('summary', s.amount === 1050 && s.count === 5 && s.activeDays === 3 && s.best?.key === '2026-03-01' && s.avg === 210);
check('summary of nothing', summarize([]).best === null && summarize([]).avg === 0);
const prev = previousRange('2026-03-08', '2026-03-14');
check('previous period: same length, right before', prev.from === '2026-03-01' && prev.to === '2026-03-07');
check('change %: none without a base', changePct(150, 100) === 50 && changePct(10, 0) === null);

// ── one day ──
const d = dayDetail(donations, withdrawals, '2026-03-01');
check('day: totals', d.amount === 450 && d.count === 3 && d.avg === 150 && d.biggest?.amount === 300);
check('day: named donors are counted once', d.uniqueDonors === 1);
check('day: hours', d.byHour[9] === 150 && d.byHour[20] === 300 && d.peakHour === 20 && d.activeHours === 2);
check('day: first and last', d.first?.getHours() === 9 && d.last?.getHours() === 20);
check('day: comments', d.comments.length === 1 && d.comments[0].comment === 'тримайтесь');
const empty = dayDetail(donations, withdrawals, '2026-03-02');
check('empty day', empty.count === 0 && empty.peakHour === null && empty.first === null);
check('a day with only a withdrawal keeps it', dayDetail([], withdrawals, '2026-03-03').withdrawals.length === 1);

// ── heatmap, running total ──
const grid = weekHourGrid(donations, '2026-03-01', '2026-03-03');
check('map: Monday first (1 March 2026 is a Sunday)', grid[6][9] === 150 && grid[1][12] === 200);
check('map: outside the range is left out', grid.flat().reduce((a, b) => a + b, 0) === 650);
const running = cumulativePoints(donations, daysInRange(donations, withdrawals, '2026-03-03', '2026-03-09'));
check('running total counts what came before the range', running[0].total === 650 && running[running.length - 1].total === 1050);

// ── days, weeks, months ──
check('units: up to a month in days, weeks from 8 days to ~3 months, months past a month',
  unitsFor(7).join() === 'day' && unitsFor(31).join() === 'day,week' && unitsFor(32).join() === 'week,month' && unitsFor(98).join() === 'week,month' && unitsFor(99).join() === 'month');
const long = daysInRange(donations, withdrawals, '2026-03-01', '2026-04-14');
const cal = groupBy(long, 'week');
check('weeks: calendar weeks, Monday to Sunday, cut to the range', cal[0].key === '2026-03-01' && cal[0].endKey === '2026-03-01' && cal[1].key === '2026-03-02' && cal[1].endKey === '2026-03-08' && cal[cal.length - 1].endKey === '2026-04-14');
check('weeks: each day in exactly one', cal.reduce((n, w) => n + daysBetween(w.key, w.endKey!), 0) === long.length && cal.reduce((a, w) => a + w.amount, 0) === 1050);
const months = groupBy(long, 'month');
check('months: calendar months, cut to the range', months.length === 2 && months[0].key === '2026-03-01' && months[0].endKey === '2026-03-31' && months[1].endKey === '2026-04-14' && months[0].amount === 1050);

// ── money known only by day ──
const extra = [{ date: '2026-03-02', amount: 1000 }, { date: '2026-02-20', amount: 70 }];
const withExtra = daysInRange(donations, withdrawals, '2026-03-01', '2026-03-09', extra);
check('extra: joins its day as money, not as donations', withExtra[1].amount === 1000 && withExtra[1].count === 0 && withExtra[1].untracked === 1000);
const sx = summarize(withExtra);
check('extra: in the total and the active days, not in the average donation', sx.amount === 2050 && sx.activeDays === 4 && sx.avg === 210 && sx.best?.key === '2026-03-02');
check('extra: before the range counts in the running total', cumulativePoints(donations, withExtra, extra)[0].total === 70 + 450);
const pd = periodDetail(donations, withdrawals, '2026-03-02', '2026-03-08', extra);
check('period: totals, its days, best day, and what has no donations', pd.amount === 1200 && pd.untracked === 1000 && pd.count === 1 && pd.days.length === 7 && pd.best?.key === '2026-03-02' && pd.withdrawn === 500 && pd.activeDays === 2);
const agg = withAmountsByDay(aggregateDonations(donations), extra);
check('aggregates: extra money in totals, days and running total; counts untouched', agg.totalAmount === 1050 + 1070 && agg.donationCount === 5 && agg.byDay.get('2026-03-02') === 1000 && agg.byDate.get('2026-03-02')?.count === 0 && agg.cumulative[agg.cumulative.length - 1].total === 2120 && agg.firstDate.getDate() === 20);

// ── a friendly jar's days from the app's readings ──
const T = (d: number) => new Date(2026, 9, d, 12).getTime();
const jd = ownJarDays({ id: 'j', name: 'j', jarId: '', addedAt: T(1), raised: 900, syncedAt: T(9), history: [{ at: T(1), raised: 300 }, { at: T(4), raised: 250 }, { at: T(5), raised: 700 }] });
check('jar days: first reading, then each rise, then the rest on the last read', jd.map((d) => `${d.date.slice(8)}:${d.amount}`).join() === '01:300,05:400,09:200', jd.map((d) => `${d.date.slice(8)}:${d.amount}`).join());
check('jar days: no history — all of it on the day it was last read', ownJarDays({ id: 'k', name: 'k', jarId: '', addedAt: T(2), raised: 500 }).map((d) => d.amount).join() === '500');

// ── helper insights ──
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 20, 12).getTime();
const jar = (over: Partial<FriendJar>): FriendJar => ({ id: 'a', name: 'А', raised: 1000, jarId: 'x', ...over });
const h = [{ at: NOW - 20 * DAY, raised: 100 }, { at: NOW - 10 * DAY, raised: 400 }, { at: NOW - DAY, raised: 1000 }];
check('growth: against the amount at the cutoff', growth(jar({ history: h }), 7, NOW)?.delta === 600);
check('growth: a short history compares with its start', growth(jar({ history: h.slice(1) }), 30, NOW)?.delta === 600);
check('growth: one point is not enough', growth(jar({ history: h.slice(0, 1) }), 7, NOW) === null);
check('stalled: an open linked jar with no change', stalledDays(jar({ history: [{ at: NOW - 6 * DAY, raised: 1000 }] }), NOW) === 6);
check('stalled: not when fresh, closed, unlinked or reached', stalledDays(jar({ history: h }), NOW) === null && stalledDays(jar({ closed: true, updatedAt: NOW - 9 * DAY }), NOW) === null && stalledDays(jar({ jarId: undefined, updatedAt: NOW - 9 * DAY }), NOW) === null && stalledDays(jar({ target: 500, updatedAt: NOW - 9 * DAY }), NOW) === null);
check('left to target', leftToTarget(jar({ target: 1500 })) === 500 && leftToTarget(jar({ target: 500 })) === 0 && leftToTarget(jar({})) === 0);
const eta = forecast(jar({ target: 1600, history: h }), NOW);
check('forecast: 900 ₴ in the last 14 days → 600 more in about 9 days', eta !== null && Math.abs(eta - (NOW + (600 / (900 / 14)) * DAY)) < DAY / 10);
check('forecast: nothing without pace or target', forecast(jar({ target: 1600 }), NOW) === null && forecast(jar({ history: h }), NOW) === null);
check('timeline: ends on the current amount', jarTimeline(jar({ raised: 1200, history: h }), NOW).at(-1)?.raised === 1200);
check('timeline: no history → one point', jarTimeline(jar({ syncedAt: 5 }), NOW).length === 1);
const days3 = jarDays(h);
check('days: one per record, the first has no change', days3.length === 3 && days3[0].change === null && days3[1].change === 300 && days3[2].change === 600);
check('days: a change over a gap says how long', days3[1].span === 10 && days3[2].span === 9);
const sameDay = jarDays([{ at: NOW - 3000, raised: 12650 }, { at: NOW, raised: 14650 }]);
check('days: a baseline and a change on one day are one day', sameDay.length === 1 && sameDay[0].change === 2000 && sameDay[0].raised === 14650);
check('days: the day after follows on', jarDays([{ at: NOW - DAY, raised: 100 }, { at: NOW, raised: 150 }])[1].span === 1);
check('filters', matchesFilter(jar({ closed: true }), 'closed', NOW) && !matchesFilter(jar({ closed: true }), 'active', NOW) && matchesFilter(jar({ jarId: undefined }), 'unlinked', NOW) && matchesFilter(jar({ target: 500 }), 'reached', NOW));

console.log(failures === 0 ? '\nAll breakdown checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
