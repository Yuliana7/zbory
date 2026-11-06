import type { Donation, FriendJar, Withdrawal } from '../../src/types';
import { addDays, changePct, cumulativePoints, dayDetail, daysBetween, daysInRange, groupWeeks, previousRange, summarize, weekHourGrid } from '../../src/utils/dailyBreakdown';
import { forecast, growth, leftToTarget, matchesFilter, stalledDays } from '../../src/utils/friendInsights';

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
check('filters', matchesFilter(jar({ closed: true }), 'closed', NOW) && !matchesFilter(jar({ closed: true }), 'active', NOW) && matchesFilter(jar({ jarId: undefined }), 'unlinked', NOW) && matchesFilter(jar({ target: 500 }), 'reached', NOW));

console.log(failures === 0 ? '\nAll breakdown checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
