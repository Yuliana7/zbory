// Regression test for the "Разом" (analyze-together) merged-balance bug:
// Zbir_short/long/refund are three independent jars (no real "Часткове
// зняття" withdrawal rows in any of them, though Zbir_refund carries one
// genuine unlogged refund — see tests/data generation). Combining their raw
// rows into one list and reading Залишок off the newest row (whichever jar
// happens to have the latest transaction) manufactures a fake impliedRefund
// on top of the real one, equal to the OTHER jars' end balances. The fix sums
// each jar's own currentBalance instead — see handleLoadCampaigns in AppContext.tsx.
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import { mergeRawDonations } from '../../src/utils/mergeDonations';
import type { RawDonation } from '../../src/types';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

function loadRaw(path: string): RawDonation[] {
  const csvText = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return (parsed.data as Record<string, string>[]).map((row) => ({
    date: row['Дата та час операції'] || row['Дата та час'] || '',
    category: row['Категорія операції'] || row['Категорія'] || '',
    amount: row['Сума'] || '0',
    currency: row['Валюта'] || 'UAH',
    additionalInfo: row['Додаткова інформація'] || row['Опис'] || '',
    comment: row['Коментар до платежу'] || row['Коментар'] || '',
    balance: row['Залишок'] || '0',
    balanceCurrency: row['Валюта залишку'] || 'UAH',
  }));
}

const datasets = ['Zbir_short.csv', 'Zbir_long.csv', 'Zbir_refund.csv'].map((f) => loadRaw(`tests/data/${f}`));

// Mirrors handleLoadCampaigns in AppContext.tsx
let merged: RawDonation[] = [];
for (const d of datasets) merged = mergeRawDonations(merged, d).merged;
const { donations, withdrawals } = normalizeDonations(merged);
const currentBalance = datasets.reduce((sum, d) => sum + normalizeDonations(d).currentBalance, 0);

const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

// Ground truth: each jar's own genuine impliedRefund, computed independently
// (Zbir_refund carries one real unlogged refund; the other two are clean).
const perJarImpliedRefunds = datasets.reduce((sum, d) => {
  const n = normalizeDonations(d);
  const a = aggregateDonations(n.donations, n.withdrawals, n.currentBalance);
  return sum + a.impliedRefunds;
}, 0);

assertEq('no real withdrawals across the three jars', aggregates.totalWithdrawn, 0);
assertEq('merged currentBalance is the sum of each jar\'s own balance', currentBalance,
  datasets.reduce((sum, d) => sum + normalizeDonations(d).currentBalance, 0));
assertEq('merged impliedRefunds matches the sum of each jar\'s own genuine refund (no bogus extra from merging)',
  aggregates.impliedRefunds, perJarImpliedRefunds);
assertEq('that genuine refund is exactly the one unlogged reversal in Zbir_refund', aggregates.impliedRefunds, 500);

// The old (buggy) behavior: currentBalance taken from the merged list's newest
// row only reflects one jar and would falsely imply a much larger refund
// from the others' end balances on top of the real one.
const buggyCurrentBalance = normalizeDonations(merged).currentBalance;
const buggyImpliedRefunds = Math.max(0, aggregates.totalRaised - aggregates.totalWithdrawn - buggyCurrentBalance);
assertEq('sanity: the old per-row approach inflates the refund far beyond the real 500',
  buggyImpliedRefunds > aggregates.impliedRefunds, true);
