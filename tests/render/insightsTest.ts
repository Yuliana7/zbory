import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations, getCampaignDuration, getTimeBuckets } from '../../src/utils/dataAggregator';
import { generateInsights } from '../../src/utils/insightGenerator';
import dict from '../../src/i18n/locales/uk/insights.json';
import { loadRawDonations } from './testFixture';

// Minimal i18next-compatible t(): key paths, uk plural rules, {{var}} interpolation
function ukPluralSuffix(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

function t(key: string, options: Record<string, unknown> = {}): string {
  const lookup = (k: string): unknown =>
    k.split('.').reduce<unknown>((obj, part) => (obj as Record<string, unknown>)?.[part], dict);

  let raw: unknown;
  if (typeof options.count === 'number') {
    raw =
      lookup(`${key}_${ukPluralSuffix(options.count)}`) ??
      lookup(`${key}_other`) ??
      lookup(key);
  } else {
    raw = lookup(key);
  }
  if (typeof raw !== 'string') return `<<MISSING: ${key}>>`;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? `<<MISSING VAR ${name}>>`));
}

const rawData = loadRawDonations('tests/data/Zbir_short.csv');

const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

console.log(`Donations: ${donations.length}, total raised: ${aggregates.totalRaised}\n`);

// Expectations verified against the real pipeline over tests/data/Zbir_short.csv
assertEq('mode (найчастіший)', aggregates.modeDonation, 100);
assertEq('median (типовий)', aggregates.medianDonation, 200);
assertEq('mean (середнє)', Math.round(aggregates.totalRaised / aggregates.donationCount), 320); // 4480/14 = 320

const buckets = Object.fromEntries(getTimeBuckets(aggregates).map((b) => [b.key, b.count]));
assertEq('morning donations', buckets.morning, 7);
assertEq('afternoon donations', buckets.afternoon, 7);
assertEq('evening donations', buckets.evening, 0);
console.log(`(night bucket: ${buckets.night})\n`);

console.log('─── Insight cards ───');
for (const ins of generateInsights(aggregates, t)) {
  console.log(`\n${ins.icon} ${ins.title}${ins.value ? ` — ${ins.value}` : ''}`);
  for (const s of ins.stats ?? []) console.log(`   ${s.icon} ${s.label}: ${s.value}`);
  if (ins.description) console.log(`   ${ins.description}`);
}

const allText = JSON.stringify(generateInsights(aggregates, t));
assertEq('no missing i18n keys/vars', allText.includes('<<MISSING'), false);

// duration counts calendar days inclusively: one day of donations is 1 day, never 0
const at = (y: number, m: number, d: number, h: number) => new Date(y, m, d, h);
const span = (a: Date, b: Date) => getCampaignDuration({ ...aggregates, firstDate: a, lastDate: b });
assertEq('duration: single day → 1', span(at(2026, 9, 8, 9), at(2026, 9, 8, 21)), 1);
assertEq('duration: late evening → early morning next day → 2', span(at(2026, 9, 8, 23), at(2026, 9, 9, 1)), 2);
assertEq('duration: 8 → 10 October → 3', span(at(2026, 9, 8, 12), at(2026, 9, 10, 12)), 3);
assertEq('duration: across a DST change stays whole days', span(at(2026, 9, 24, 12), at(2026, 9, 26, 12)), 3);
