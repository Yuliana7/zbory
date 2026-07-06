import {
  rawDonationsToManualRows,
  computeBalances,
  sortChronologically,
  manualRowsToCSVString,
} from '../../src/utils/csvExporter';
import type { RawDonation } from '../../src/types';

// The exact 5-row scenario from claude.md Phase 7 (newest-first, as in a CSV)
const raw: RawDonation[] = [
  { date: '01.07.2026 12:26', category: 'За посиланням', amount: '333.00', currency: 'UAH', additionalInfo: 'Від: Наталія Булейко', comment: 'Поповнення рахунку банки', balance: '644.11', balanceCurrency: 'UAH' },
  { date: '01.07.2026 11:08', category: 'За посиланням', amount: '50.00', currency: 'UAH', additionalInfo: 'Від: Олександр Ступницький', comment: 'Поповнення рахунку банки', balance: '311.11', balanceCurrency: 'UAH' },
  { date: '01.07.2026 10:54', category: 'За посиланням', amount: '100.00', currency: 'UAH', additionalInfo: 'Від: Оксана Філипчук', comment: 'Поповнення рахунку банки', balance: '261.11', balanceCurrency: 'UAH' },
  { date: '01.07.2026 10:52', category: 'За посиланням', amount: '50.00', currency: 'UAH', additionalInfo: 'Від: Любомира-Анна Климкович', comment: 'Поповнення рахунку банки', balance: '161.11', balanceCurrency: 'UAH' },
  { date: '01.07.2026 09:53', category: 'За посиланням', amount: '111.11', currency: 'UAH', additionalInfo: 'Від: Марта-Марія Плечій', comment: '❤️❤️❤️❤️', balance: '111.11', balanceCurrency: 'UAH' },
];

let rows = rawDonationsToManualRows(raw); // oldest-first, all balances explicit

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

// Untouched CSV rows: stored bank balances are authoritative
let balances = computeBalances(rows);
assertEq('untouched row 5 balance', balances.get(rows[4].id), '644.11');

// Simulate updateBalance(row 4 -> 411.11): set override, clear later rows' balances
const editedId = rows[3].id;
rows = rows.map((r) => (r.id === editedId ? { ...r, balance: '411.11' } : r));
const sorted = sortChronologically(rows);
const pos = sorted.findIndex((r) => r.id === editedId);
const laterIds = new Set(sorted.slice(pos + 1).map((r) => r.id));
rows = rows.map((r) => (laterIds.has(r.id) && r.balance !== '' ? { ...r, balance: '' } : r));

balances = computeBalances(rows);
assertEq('row 1 keeps its balance', balances.get(rows[0].id), '111.11');
assertEq('row 3 keeps its balance', balances.get(rows[2].id), '261.11');
assertEq('row 4 uses the override', balances.get(rows[3].id), '411.11');
assertEq('row 5 recalculated (411.11 + 333.00)', balances.get(rows[4].id), '744.11');

// The exported CSV must carry the recalculated balances too
const csv = manualRowsToCSVString(rows);
const firstDataLine = csv.split('\n')[1]; // newest-first => row 5
assertEq('exported CSV row 5 balance', firstDataLine.includes(',744.11,UAH'), true);
console.log('\nExported CSV:\n' + csv);
