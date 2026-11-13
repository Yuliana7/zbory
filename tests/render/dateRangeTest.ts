import { clampDate, orderedRange } from '../../src/utils/dateRange';
import { filterAggregates } from '../../src/utils/exportStack';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import type { Donation } from '../../src/types';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

// iOS ignores min/max on date inputs, so DateField clamps what was picked.
check('clamp: a day inside the limits is kept', clampDate('2026-11-08', '2026-11-06', '2026-11-13') === '2026-11-08');
check('clamp: «До» before «Від» snaps to «Від»', clampDate('2026-11-06', '2026-11-13') === '2026-11-13');
check('clamp: «Від» after «До» snaps to «До»', clampDate('2026-11-13', undefined, '2026-11-06') === '2026-11-06');
check('clamp: clearing the field stays empty', clampDate('', '2026-11-13', '2026-11-20') === '');
check('clamp: no limits → unchanged', clampDate('2026-01-01') === '2026-01-01');

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

console.log(failures === 0 ? '\nAll date range checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
