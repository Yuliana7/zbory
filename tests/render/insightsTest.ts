import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations, getTimeBuckets } from '../../src/utils/dataAggregator';
import { generateInsights, generateActionableInsights } from '../../src/utils/insightGenerator';
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

const rawData = loadRawDonations('testData/Zbir_1.csv');

const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

console.log(`Donations: ${donations.length}, total raised: ${aggregates.totalRaised}\n`);

// Expectations verified against the real pipeline over testData/Zbir_1.csv
assertEq('mode (найчастіший)', aggregates.modeDonation, 333);
assertEq('median (типовий)', aggregates.medianDonation, 333);
assertEq('mean (середнє)', Math.round(aggregates.totalRaised / aggregates.donationCount), 511); // 11752/23 = 511

const buckets = Object.fromEntries(getTimeBuckets(aggregates).map((b) => [b.key, b.count]));
assertEq('morning donations', buckets.morning, 8);
assertEq('afternoon donations', buckets.afternoon, 13);
assertEq('evening donations', buckets.evening, 2);
console.log(`(night bucket: ${buckets.night})\n`);

console.log('─── Insight cards ───');
for (const ins of generateInsights(aggregates, t)) {
  console.log(`\n${ins.icon} ${ins.title}${ins.value ? ` — ${ins.value}` : ''}`);
  for (const s of ins.stats ?? []) console.log(`   ${s.icon} ${s.label}: ${s.value}`);
  if (ins.description) console.log(`   ${ins.description}`);
}

console.log('\n─── Що робити далі (goal = 20 000) ───');
for (const a of generateActionableInsights(aggregates, t, 20000)) {
  console.log(`\n${a.icon} ${a.title} — ${a.value}`);
  if (a.description) console.log(`   ${a.description}`);
}

const allText = JSON.stringify([generateInsights(aggregates, t), generateActionableInsights(aggregates, t, 20000)]);
assertEq('no missing i18n keys/vars', allText.includes('<<MISSING'), false);
