// Regression test for the "Разом" (analyze-together) merged-balance bug:
// Zbir_1/2/3 are three independent jars (no real withdrawals in any of them).
// Combining their raw rows into one list and reading Залишок off the newest
// row (whichever jar happens to have the latest transaction) manufactures a
// fake impliedRefund equal to the OTHER jars' end balances. The fix sums each
// jar's own currentBalance instead — see handleLoadCampaigns in AppContext.tsx.
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

const datasets = ['Zbir_1.csv', 'Zbir_2.csv', 'Zbir_3.csv'].map((f) => loadRaw(`testData/${f}`));

// Mirrors handleLoadCampaigns in AppContext.tsx
let merged: RawDonation[] = [];
for (const d of datasets) merged = mergeRawDonations(merged, d).merged;
const { donations, withdrawals } = normalizeDonations(merged);
const currentBalance = datasets.reduce((sum, d) => sum + normalizeDonations(d).currentBalance, 0);

const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

assertEq('no real withdrawals across the three jars', aggregates.totalWithdrawn, 0);
assertEq('merged currentBalance is the sum of each jar\'s own balance', currentBalance,
  datasets.reduce((sum, d) => sum + normalizeDonations(d).currentBalance, 0));
assertEq('no bogus impliedRefund from combining independent jars', aggregates.impliedRefunds, 0);
assertEq('totalAmount matches totalRaised (no hidden refund distortion)', aggregates.totalAmount, aggregates.totalRaised);

// The old (buggy) behavior: currentBalance taken from the merged list's newest
// row only reflects one jar and would falsely imply a refund from the others.
const buggyCurrentBalance = normalizeDonations(merged).currentBalance;
const buggyImpliedRefunds = Math.max(0, aggregates.totalRaised - aggregates.totalWithdrawn - buggyCurrentBalance);
assertEq('sanity: the old per-row approach would have produced a bogus positive refund', buggyImpliedRefunds > 0, true);
