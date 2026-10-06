import {
  kyivWallClockToUnix,
  rowTimestamp,
  unixToKyivWallClock,
  withTimestamps,
} from '../../src/utils/timestamps';
import { normalizeDonations } from '../../src/utils/csvParser';
import { manualRowsToCSVString, manualRowsToRawDonations, rawDonationsToManualRows } from '../../src/utils/csvExporter';
import { mergeRawDonations } from '../../src/utils/mergeDonations';
import { statementItemsToRawDonations } from '../../src/utils/monobankApi';
import type { ManualRow, RawDonation } from '../../src/types';

// Written to pass in ANY time zone (npm run test:tz runs it under six).
let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};
const U = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s) / 1000;

// ── Kyiv clock text ⇄ Unix time (the CSV's convention) ──
check('summer: 16:00 Kyiv is 13:00 UTC', kyivWallClockToUnix('06.10.2026 16:00') === U(2026, 10, 6, 13, 0));
check('winter: 14:00 Kyiv is 12:00 UTC', kyivWallClockToUnix('15.01.2026 14:00') === U(2026, 1, 15, 12, 0));
check('seconds are read when present', kyivWallClockToUnix('06.10.2026 16:00:54') === U(2026, 10, 6, 13, 0, 54));
check('no time → midnight Kyiv', kyivWallClockToUnix('06.10.2026') === U(2026, 10, 5, 21, 0));
check('not a date → null', kyivWallClockToUnix('') === null && kyivWallClockToUnix('abc') === null && kyivWallClockToUnix('45.13.2026 10:00') === null);
check('round trip', unixToKyivWallClock(kyivWallClockToUnix('06.10.2026 16:00')!) === '06.10.2026 16:00');
check('spring change: 02:59 then 04:00', unixToKyivWallClock(U(2026, 3, 29, 0, 59)) === '29.03.2026 02:59' && unixToKyivWallClock(U(2026, 3, 29, 1, 0)) === '29.03.2026 04:00');
check('autumn change: 03:59 then 03:00 again', unixToKyivWallClock(U(2026, 10, 25, 0, 59)) === '25.10.2026 03:59' && unixToKyivWallClock(U(2026, 10, 25, 1, 0)) === '25.10.2026 03:00');

// ── rows: ts is the truth, the clock text is the fallback ──
const row = (date: string, amount: string, balance: string, ts?: number): RawDonation => ({
  date, ts, category: 'За посиланням', amount, currency: 'UAH', additionalInfo: 'Від: Тест', comment: '', balance, balanceCurrency: 'UAH',
});
check('rowTimestamp prefers the stored ts', rowTimestamp(row('06.10.2026 16:00', '1', '1', 123)) === 123);
check('rowTimestamp falls back to the Kyiv clock text', rowTimestamp(row('06.10.2026 16:00', '1', '1')) === U(2026, 10, 6, 13, 0));
const old = [row('06.10.2026 16:00', '1', '1'), row('bad', '1', '1')];
const filled = withTimestamps(old);
check('withTimestamps fills what it can', filled[0].ts === U(2026, 10, 6, 13, 0) && filled[1].ts === undefined);
const complete = [row('06.10.2026 16:00', '1', '1', U(2026, 10, 6, 13, 0))];
check('withTimestamps leaves complete data alone (same array)', withTimestamps(complete) === complete);

// ── what the app computes from: a true instant (local display and buckets follow from it) ──
const n = normalizeDonations([row('06.10.2026 16:00', '500.00', '45818.13')]);
check('normalizeDonations: the donation is at the true instant', n.donations[0].timestamp.getTime() === U(2026, 10, 6, 13, 0) * 1000);

// ── manual entry works on the user's clock; the CSV text it writes stays Kyiv ──
const typed: ManualRow = { id: 'm1', date: '2026-10-06', time: '18:30', name: 'Тест', amount: '100', comment: '', balance: '100' };
const [fromManual] = manualRowsToRawDonations([typed]);
const typedInstant = new Date(2026, 9, 6, 18, 30).getTime() / 1000;
check('manual: ts is the instant of the typed local time', fromManual.ts === typedInstant);
check('manual: the clock text is that instant spelled in Kyiv time', fromManual.date === unixToKyivWallClock(typedInstant));
check('manual: the CSV download uses Kyiv clock text', manualRowsToCSVString([typed]).split('\n')[1].startsWith(unixToKyivWallClock(typedInstant) + ','));
const [back] = rawDonationsToManualRows([fromManual]);
check('manual: editing shows the row on the user\'s clock again', back.date === '2026-10-06' && back.time === '18:30');
const [shown] = rawDonationsToManualRows([row('06.10.2026 16:00', '1', '1', U(2026, 10, 6, 13, 0))]);
const local = new Date(U(2026, 10, 6, 13, 0) * 1000);
const p2 = (x: number) => String(x).padStart(2, '0');
check('manual: a CSV row opens on the user\'s clock', shown.time === `${p2(local.getHours())}:${p2(local.getMinutes())}`);

// ── the reported case: a CSV and the API describe the same donations; matching must not depend on the device's zone ──
const real: Array<[string, number, string, string]> = [
  ['06.10.2026 16:00', 1791291654, '500.00', '45818.13'], ['06.10.2026 15:49', 1791290987, '20.00', '45318.13'],
  ['06.10.2026 15:46', 1791290800, '100.00', '45298.13'], ['06.10.2026 13:43', 1791283400, '100.00', '45198.13'],
  ['06.10.2026 13:24', 1791282278, '100.00', '45098.13'], ['06.10.2026 13:24', 1791282275, '100.00', '44998.13'],
];
const csvRows = real.map(([date, , amount, balance]) => row(date, amount, balance));            // as a parsed CSV: text only
const apiRows = statementItemsToRawDonations(real.map(([, time, amount, balance], i) => ({
  id: 'a' + i, time, description: 'Від: Тест', amount: Math.round(parseFloat(amount) * 100), balance: Math.round(parseFloat(balance) * 100),
})));
const merged = mergeRawDonations(csvRows, apiRows);
check('CSV + API of the same donations: all recognised, in any zone', merged.duplicates === 6 && merged.added === 0, `${merged.duplicates}/${merged.added}`);
check('…without needing the clock-offset fallback', merged.timeShiftMinutes === null);
check('…and the saved rows keep their instant', merged.merged.every((r) => rowTimestamp(r) !== null));

// two CSV exports with the same instants but one carrying seconds / ts, the other only text
const tsRows = csvRows.map((r) => ({ ...r, ts: kyivWallClockToUnix(r.date)! }));
check('rows with ts match rows with only clock text', mergeRawDonations(tsRows, csvRows).duplicates === 6);

console.log(failures === 0 ? '\nAll timestamp checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
