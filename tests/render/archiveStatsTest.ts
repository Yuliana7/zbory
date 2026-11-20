import type { Donation } from '../../src/types';
import type { CampaignMeta } from '../../src/utils/campaignStore';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import { bestMoments, compareToOthers, loyalty, milestones, rhythm, sizeBands } from '../../src/utils/archiveStats';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

// Mon 2 Nov 2026 … : day d (1-based), hour h
const at = (day: number, hour = 12, min = 0) => new Date(2026, 10, 1 + day, hour, min);
const don = (day: number, amount: number, donor?: string, hour = 12): Donation => ({ timestamp: at(day, hour), amount, donor, category: '' });

const donations: Donation[] = [
  don(1, 50, 'Оля'),
  don(1, 200, 'Назар', 20),
  don(2, 250, 'оля '), // the same Оля
  don(3, 2000, 'Ірина', 20),
  don(3, 500, undefined, 20),
  don(6, 1000, '🐈'),
  don(7, 1000, 'Оля', 9),
];
const total = 5000;
const aggregates = aggregateDonations(donations);

// ── growth ──
{
  const m = milestones(aggregates.cumulative, 4000);
  check('milestones: each quarter of the goal, on the day it was crossed', m.map((x) => `${x.pct}@${x.day}`).join() === '25@3,50@3,75@3,100@6', m.map((x) => `${x.pct}@${x.day}`).join());
  check('milestones: an unreached quarter is left out', milestones(aggregates.cumulative, 10000).map((x) => x.pct).join() === '25,50', milestones(aggregates.cumulative, 10000).map((x) => x.pct).join());
  check('milestones: no goal → quarters of the final total', milestones(aggregates.cumulative, total).at(-1)?.day === 7);
  check('milestones: nothing for an empty project', milestones([], 100).length === 0);

  const b = bestMoments(donations);
  check('moments: the record day', b.bestDay?.amount === 2500 && b.bestDay.date === '2026-11-04');
  check('moments: the record hour, on its own day', b.bestHour?.amount === 2500 && b.bestHour.hour === 20 && b.bestHour.date === '2026-11-04');
  check('moments: the longest run of days with donations', b.streak.days === 3 && b.streak.from === '2026-11-02' && b.streak.to === '2026-11-04', JSON.stringify(b.streak));

  const r = rhythm(donations);
  check('rhythm: weekdays from Monday', r.weekdays[0] === 250 && r.weekdays[2] === 2500 && r.weekdays[6] === 1000 && r.bestWeekday === 2, r.weekdays.join());
  check('rhythm: the hour of the day that brought most', r.bestHour === 20 && r.hours[20] === 2700);
}

// ── supporters ──
{
  const bands = sizeBands(donations);
  const small = bands.find((x) => x.key === 'small')!;
  const large = bands.find((x) => x.key === 'large')!;
  check('bands: under 100 / 100–1000 / over 1000, as in the analytics', bands.map((x) => x.count).join() === '1,5,1');
  check('bands: shares of donations and of money', Math.abs(small.countShare - 1 / 7) < 1e-9 && large.amountShare === 2000 / total);

  const l = loyalty(donations);
  check('loyalty: named donors, anonymous ones apart', l.named === 3 && l.anonymous === 2, `${l.named}/${l.anonymous}`);
  check('loyalty: the same name, any case or spacing, is one donor who came back', l.returning === 1 && l.mostLoyal?.count === 3 && l.mostLoyal.amount === 1300);
  check('loyalty: the returning donors’ share of the money', l.returningShare === 1300 / total);
  check('loyalty: top donors by amount', l.top.map((p) => p.amount).join() === '2000,1300,200');
  check('loyalty: nobody came back → no most loyal', loyalty([don(1, 100, 'А'), don(2, 100, 'Б')]).mostLoyal === null);
}

// ── against the others ──
{
  const meta = (id: string, totalAmount: number, firstDate: string, lastDate: string) =>
    ({ id, name: id, fileName: null, createdAt: 0, updatedAt: 0, summary: { totalAmount, donationCount: 1, firstDate, lastDate, currentBalance: 0 } }) as CampaignMeta;
  const self = meta('a', 300000, '2026-08-01', '2026-08-30'); // 30 days
  const c = compareToOthers(self, [self, meta('b', 100000, '2026-01-01', '2026-01-30'), meta('c', 200000, '2026-03-01', '2026-03-20')]);
  check('compare: against the average of the others, not itself', c?.ratio === 2 && c.others === 2, JSON.stringify(c));
  check('compare: days against their average', c?.dayDiff === 5, JSON.stringify(c));
  check('compare: nothing to compare with → nothing shown', compareToOthers(self, [self]) === null);
}

console.log(failures === 0 ? '\nAll archive stats checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
