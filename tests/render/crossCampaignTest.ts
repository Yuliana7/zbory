import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '../../src/i18n';
import { analyzeCampaigns, buildReport } from '../../src/utils/campaignAnalytics';
import { ReportCard } from '../../src/components/templates/ReportCard';
import type { CampaignMeta } from '../../src/utils/campaignStore';
import type { RawDonation } from '../../src/types';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

const row = (date: string, amount: string, info: string, balance = '0.00'): RawDonation => ({
  date,
  category: 'За посиланням',
  amount,
  currency: 'UAH',
  additionalInfo: info,
  comment: '',
  balance,
  balanceCurrency: 'UAH',
});

const meta = (id: string, firstDate: string): CampaignMeta => ({
  id,
  name: id,
  fileName: null,
  createdAt: 0,
  updatedAt: 0,
  summary: { totalAmount: 0, donationCount: 0, firstDate, lastDate: '', currentBalance: 0 },
});

// Campaign A: Q2 2026, 3 days. Олена donates twice (different spellings/case),
// plus the owner's own top-up and an anonymous cat — both excluded from identity.
const jarA: RawDonation[] = [
  row('12.04.2026 10:00', '100.00', 'Від: Олена Петренко'),
  row('13.04.2026 11:00', '50.00', 'Від: олена  петренко'),
  row('13.04.2026 12:00', '200.00', 'З чорної картки'),
  row('14.04.2026 09:00', '30.00', '🐈'),
  row('14.04.2026 10:00', '300.00', 'Від: Юрій Гулянич'),
];

// Campaign B: Q3 2026, 2 days. Олена again; Марта is new.
const jarB: RawDonation[] = [
  row('01.07.2026 09:00', '500.00', 'Від: Олена Петренко'),
  row('02.07.2026 09:00', '70.00', 'Від: Марта-Марія Плечій'),
];

const stats = analyzeCampaigns([
  { meta: meta('a', '2026-04-12'), rawData: jarA },
  { meta: meta('b', '2026-07-01'), rawData: jarB },
]);

assertEq('campaigns analyzed', stats.campaigns.length, 2);
assertEq('campaigns newest-first', stats.campaigns[0].meta.id, 'b');
assertEq('total across campaigns', stats.totalAmount, 1250);
assertEq('total donations', stats.totalDonations, 7);

// Named identity: Олена (merged spellings) + Юрій + Марта; cat and self-top-up excluded
assertEq('unique named donors', stats.uniqueDonors, 3);
assertEq('cross donors: only Олена in both jars', stats.crossDonors.length, 1);
assertEq('cross donor name', stats.crossDonors[0].name, 'Олена Петренко');
assertEq('cross donor campaigns', stats.crossDonors[0].campaignCount, 2);
assertEq('cross donor donations', stats.crossDonors[0].donationCount, 3);
assertEq('cross donor total', stats.crossDonors[0].totalAmount, 650);

// Campaign A curve: day0=100, day1=350 (50+200+100), day2=680
const a = stats.campaigns.find((c) => c.meta.id === 'a')!;
assertEq('A: days', a.days, 3);
assertEq('A: cumulative day 0', a.cumulativeByDay[0], 100);
assertEq('A: cumulative day 1', a.cumulativeByDay[1], 350);
assertEq('A: cumulative day 2', a.cumulativeByDay[2], 680);
assertEq('A: median donation', a.medianDonation, 100);

// Quarters: Q2 = jar A (680 / 5), Q3 = jar B (570 / 2)
assertEq('quarters count', stats.quarters.length, 2);
assertEq('Q2 amount', stats.quarters[0].amount, 680);
assertEq('Q2 label parts', `${stats.quarters[0].quarter}-${stats.quarters[0].year}`, '2-2026');
assertEq('Q3 amount', stats.quarters[1].amount, 570);
assertEq('Q3 donation count', stats.quarters[1].count, 2);
assertEq('Q3 campaigns', stats.quarters[1].campaignCount, 1);

// ── buildReport: period filters ──
const itemsInput = [
  { meta: meta('a', '2026-04-12'), rawData: jarA },
  { meta: meta('b', '2026-07-01'), rawData: jarB },
];

const q2 = buildReport(itemsInput, { kind: 'quarter', year: 2026, quarter: 2 });
assertEq('report Q2: total', q2.totalAmount, 680);
assertEq('report Q2: only jar A active', q2.campaignCount, 1);
assertEq('report Q2: donations', q2.donationCount, 5);
assertEq('report Q2: named donors (self excluded)', q2.uniqueDonors, 2);
assertEq('report Q2: anonymous counted', q2.anonymousDonations, 1);
assertEq('report Q2: span start', q2.firstDate?.getDate(), 12);

const year = buildReport(itemsInput, { kind: 'year', year: 2026 });
assertEq('report 2026: total', year.totalAmount, 1250);
assertEq('report 2026: campaigns', year.campaignCount, 2);
assertEq('report 2026: donors merged across jars', year.uniqueDonors, 3);
assertEq('report 2026: top campaign is A', year.topCampaigns[0].name, 'a');
assertEq('report 2026: top campaign amount', year.topCampaigns[0].amount, 680);

const empty = buildReport(itemsInput, { kind: 'quarter', year: 2026, quarter: 1 });
assertEq('report empty quarter: zero donations', empty.donationCount, 0);
assertEq('report empty quarter: no campaigns', empty.campaignCount, 0);

// ── ReportCard renders the report ──
const html = renderToStaticMarkup(
  createElement(ReportCard, { report: year, periodLabel: 'зібрано за 2026 рік', format: 'story' }),
);
const strip = (s: string) => s.replace(/<[^>]+>/g, ' ');
assertEq('card: default title', html.includes('Звіт про збори'), true);
assertEq('card: hero total present', /1[\s\u00A0\u202F]?250[\s\u00A0\u202F]*₴/.test(strip(html)), true);
assertEq('card: period label', html.includes('зібрано за 2026 рік'), true);
assertEq('card: top campaigns block', html.includes('Найбільші збори'), true);
assertEq('card: date span in header', html.includes('12.04.2026 — 02.07.2026'), true);
assertEq('card: thanks line', html.includes('Дякуємо кожному'), true);
// Amount + ₴ must sit inside a nowrap span so the sign can't wrap alone on export
assertEq('card: hero wrapped in NoWrap', /white-space:nowrap[^>]*>1[\s\u00A0\u202F]?250[\s\u00A0\u202F]*₴/.test(html), true);
