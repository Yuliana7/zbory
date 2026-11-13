import { orderedRange, formatDateRange, isoToDate, dateToIso } from '../../src/utils/dateRange';
import { filterAggregates, donationsInRange } from '../../src/utils/exportStack';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import type { Donation } from '../../src/types';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};


check('order: a backwards range is swapped', orderedRange('2026-11-13', '2026-11-06').join() === '2026-11-06,2026-11-13');
check('order: a forwards range is kept', orderedRange('2026-11-06', '2026-11-13').join() === '2026-11-06,2026-11-13');
check('order: an open end is kept', orderedRange('2026-11-13', '').join() === '2026-11-13,');

const donation = (day: string, amount: number): Donation =>
  ({ timestamp: new Date(`${day}T12:00:00`), name: 'Тест', amount, balance: 0, comment: '' }) as unknown as Donation;
const donations = [donation('2026-11-05', 100), donation('2026-11-08', 200), donation('2026-11-14', 400)];
const full = aggregateDonations(donations);
const forwards = filterAggregates(donations, full, '2026-11-06', '2026-11-13');
const backwards = filterAggregates(donations, full, '2026-11-13', '2026-11-06');
check('filter: a forwards range counts only its days', forwards.donationCount === 1);
check('filter: a saved backwards range reads the same days, not the whole campaign', backwards.donationCount === 1);

check('filter: an empty range counts 0 donations but the card keeps the whole campaign',
  donationsInRange(donations, '2026-11-09', '2026-11-10').length === 0 && filterAggregates(donations, full, '2026-11-09', '2026-11-10').donationCount === 3);
check('filter: an open end counts to the last donation', donationsInRange(donations, '2026-11-06', '').length === 2);

check('iso: a day round-trips through a local date', dateToIso(isoToDate('2026-03-29')) === '2026-03-29' && isoToDate('2026-03-29').getHours() === 0);
check('format: a range in one month', formatDateRange('2026-11-06', '2026-11-13') === '6–13 лист. 2026 р.');
check('format: a backwards range reads forwards', formatDateRange('2026-11-13', '2026-11-06') === '6–13 лист. 2026 р.');
check('format: one day', formatDateRange('2026-11-06', '2026-11-06') === '6 лист. 2026 р.');
check('format: nothing set', formatDateRange('', '') === '');

console.log(failures === 0 ? '\nAll date range checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
