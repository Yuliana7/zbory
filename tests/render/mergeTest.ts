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

// ── the same operations written differently by two sources ──
// (a CSV with seconds and comma decimals vs. rows built from the Monobank API)
const csvStyle = [
  row('05.10.2026 13:36:12', '2 000,00', '60176,16'),
  row('05.10.2026 13:28:40', '150,50', '58176,16'),
  row('05.10.2026 13:18:03', '100,00', '58025,66'),
];
const apiStyle = [
  row('05.10.2026 13:36', '2000.00', '60176.16'),
  row('05.10.2026 13:28', '150.50', '58176.16'),
  row('05.10.2026 13:18', '100.00', '58025.66'),
];
const formats = mergeRawDonations(csvStyle, apiStyle);
assertEq('formats: seconds, comma decimals and thousands spaces still match', formats.duplicates, 3);
assertEq('formats: nothing added', formats.added, 0);
assertEq('formats: no clock shift reported', formats.timeShiftMinutes, null);

// ── two sources with different clocks (e.g. UTC vs local time, 3 h apart) ──
const local = [
  row('05.10.2026 16:40', '500.00', '3500.00'),
  row('05.10.2026 14:05', '250.00', '3000.00'),
  row('05.10.2026 11:20', '100.00', '2750.00'),
  row('04.10.2026 22:15', '75.00', '2650.00'),
];
const utc = local.map((r) => {
  const [d, t] = r.date.split(' ');
  const [dd, mm, yyyy] = d.split('.').map(Number);
  const [h, m] = t.split(':').map(Number);
  const x = new Date(yyyy, mm - 1, dd, h - 3, m); // same instant, written 3 h earlier
  const p = (n: number) => String(n).padStart(2, '0');
  return { ...r, date: `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}` };
});
const shifted = mergeRawDonations(local, utc);
assertEq('clock shift: all rows recognised as the same operations', shifted.duplicates, 4);
assertEq('clock shift: nothing doubled', shifted.merged.length, 4);
assertEq('clock shift: the offset is reported (existing rows are 180 min ahead)', shifted.timeShiftMinutes, 180);
assertEq('clock shift: the existing rows are the ones kept', shifted.merged[0].date, '05.10.2026 16:40');

// a new donation arriving in the second source alongside the shifted duplicates is still added
const shiftedPlusNew = mergeRawDonations(local, [{ ...utc[0], date: '05.10.2026 15:00', amount: '40.00', balance: '3540.00' }, ...utc]);
assertEq('clock shift: a genuinely new row is still added', shiftedPlusNew.added, 1);
assertEq('clock shift: with the rest recognised', shiftedPlusNew.duplicates, 4);

// ── a single coincidence is not enough to call two rows the same ──
const coincidence = mergeRawDonations(
  [row('01.07.2026 10:00', '100.00', '200.00'), row('02.07.2026 11:00', '55.00', '255.00')],
  [row('01.07.2026 13:00', '100.00', '200.00'), row('03.07.2026 09:00', '70.00', '325.00')],
);
assertEq('coincidence: one matching pair at an odd offset is NOT a duplicate', coincidence.duplicates, 0);
assertEq('coincidence: both rows kept', coincidence.merged.length, 4);

// ── repeated rows are separate operations unless the base has them too ──
const doubled = mergeRawDonations(
  [row('01.07.2026 10:00', '100.00', '200.00')],
  [row('01.07.2026 10:00', '100.00', '200.00'), row('01.07.2026 10:00', '100.00', '200.00')],
);
assertEq('repeated rows: the one the base already has is a duplicate', doubled.duplicates, 1);
assertEq('repeated rows: the second identical one is kept', doubled.added, 1);

// ── warning when new rows land inside the period we already have but nothing matched ──
const overlapping = mergeRawDonations(
  existing,
  [row('03.07.2026 08:00', '10.00', '1.00'), row('02.07.2026 08:00', '11.00', '2.00'), row('01.07.2026 15:00', '12.00', '3.00')],
);
assertEq('overlap warning: rows inside the covered period, none matched', overlapping.suspectedOverlap, true);
assertEq('no warning when rows were recognised', mergeRawDonations(existing, incoming).suspectedOverlap, false);
assertEq('no warning for a chunk that continues after the base', mergeRawDonations(existing, [
  row('06.07.2026 10:00', '1.00', '1.00'), row('07.07.2026 10:00', '2.00', '2.00'), row('08.07.2026 10:00', '3.00', '3.00'),
]).suspectedOverlap, false);
assertEq('no warning when the base is empty', mergeRawDonations([], incoming).suspectedOverlap, false);
