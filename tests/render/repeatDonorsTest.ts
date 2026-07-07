import { analyzeComments, attachCampaignCounts } from '../../src/utils/commentAnalyzer';
import { normalizeDonations } from '../../src/utils/csvParser';
import type { RawDonation } from '../../src/types';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

const row = (date: string, amount: string, info: string, comment = 'Тримайтесь! 💪'): RawDonation => ({
  date,
  category: 'За посиланням',
  amount,
  currency: 'UAH',
  additionalInfo: info,
  comment,
  balance: '0.00',
  balanceCurrency: 'UAH',
});

// Enough personal comments to clear analyzeComments' 5-comment / 3% threshold.
// Олена repeats 3x (by name); 🐈 repeats 3x too but must never surface as an
// identity; Юрій gives one large donation (must still rank by sum without a
// count>=2 filter, unlike the repeat-donors list).
const raw: RawDonation[] = [
  row('01.07.2026 09:00', '50.00', 'Від: Олена Петренко'),
  row('01.07.2026 09:05', '50.00', 'Від: Олена Петренко'),
  row('01.07.2026 09:10', '50.00', 'Від: Олена Петренко'),
  row('01.07.2026 09:15', '30.00', '🐈'),
  row('01.07.2026 09:20', '30.00', '🐈'),
  row('01.07.2026 09:25', '30.00', '🐈'),
  row('01.07.2026 09:30', '5000.00', 'Від: Юрій Гулянич'),
  row('01.07.2026 09:35', '10.00', 'Від: Марта'),
];

const { donations } = normalizeDonations(raw);
const insights = analyzeComments(donations);

assertEq('hasEnoughData (8 personal comments)', insights.hasEnoughData, true);
assertEq('repeatDonors excludes 🐈', insights.repeatDonors.some((d) => d.identity === '🐈'), false);
assertEq('repeatDonors includes Олена (3x)', insights.repeatDonors.some((d) => d.identity === 'Олена Петренко' && d.count === 3), true);
assertEq('topDonorsBySum excludes 🐈', insights.topDonorsBySum.some((d) => d.identity === '🐈'), false);
assertEq('topDonorsBySum includes one-time whale (Юрій, no count filter)', insights.topDonorsBySum.some((d) => d.identity === 'Юрій Гулянич' && d.count === 1), true);
assertEq('topDonorsBySum ranked by amount, Юрій first', insights.topDonorsBySum[0]?.identity, 'Юрій Гулянич');

// ── attachCampaignCounts: identity present in 2 of 3 "campaigns" ──
const campaignA = raw.slice(0, 4); // Олена x3 + one 🐈
const campaignB = [row('05.07.2026 10:00', '20.00', 'Від: Олена Петренко')]; // Олена again
const campaignC = [row('05.07.2026 11:00', '15.00', 'Від: Марта')]; // no Олена

const enriched = attachCampaignCounts(insights.repeatDonors, [
  { rawData: campaignA },
  { rawData: campaignB },
  { rawData: campaignC },
]);
const olena = enriched.find((d) => d.identity === 'Олена Петренко');
assertEq('campaignCount: Олена in 2 of 3 campaigns', olena?.campaignCount, 2);
