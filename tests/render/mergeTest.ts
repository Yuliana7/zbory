import { mergeRawDonations } from '../../src/utils/mergeDonations';
import type { RawDonation } from '../../src/types';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

const row = (date: string, amount: string, balance: string, info = 'Від: Тест'): RawDonation => ({
  date,
  category: 'За посиланням',
  amount,
  currency: 'UAH',
  additionalInfo: info,
  comment: '',
  balance,
  balanceCurrency: 'UAH',
});

// First export: July 1–3 (newest-first)
const existing = [
  row('03.07.2026 12:26', '333.00', '644.11'),
  row('02.07.2026 10:52', '200.00', '311.11'),
  row('01.07.2026 09:53', '111.11', '111.11'),
];

// Second export: July 2–5, overlapping the first
const incoming = [
  row('05.07.2026 18:00', '500.00', '1194.11'),
  row('04.07.2026 08:15', '50.00', '694.11'),
  row('03.07.2026 12:26', '333.00', '644.11'), // duplicate
  row('02.07.2026 10:52', '200.00', '311.11'), // duplicate
];

const result = mergeRawDonations(existing, incoming);
assertEq('merge: added', result.added, 2);
assertEq('merge: duplicates skipped', result.duplicates, 2);
assertEq('merge: total rows', result.merged.length, 5);
assertEq('merge: newest-first after merge', result.merged[0].date, '05.07.2026 18:00');
assertEq('merge: oldest last', result.merged[4].date, '01.07.2026 09:53');
assertEq('merge: existing row kept', result.merged[2].date, '03.07.2026 12:26');

// Same minute + same amount but different balance = two real donations, not a dupe
const twin = mergeRawDonations(
  [row('01.07.2026 10:00', '100.00', '200.00')],
  [row('01.07.2026 10:00', '100.00', '300.00')],
);
assertEq('twin donations: both kept', twin.merged.length, 2);
assertEq('twin donations: none counted as duplicate', twin.duplicates, 0);

// Merging into an empty dataset just adopts the file
const fresh = mergeRawDonations([], incoming);
assertEq('empty base: all added', fresh.added, 4);

// Re-merging the same file is a no-op
const again = mergeRawDonations(result.merged, incoming);
assertEq('idempotent: nothing added twice', again.added, 0);
assertEq('idempotent: all counted as duplicates', again.duplicates, 4);
