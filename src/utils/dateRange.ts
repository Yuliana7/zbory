/** Helpers for YYYY-MM-DD date ranges. ISO dates compare correctly as plain strings. */

/** A range saved backwards (possible with the two native date inputs used before
 * DateRangeField, since iOS ignores their min/max) is read the right way round. */
export function orderedRange(from: string, to: string): [string, string] {
  return from && to && from > to ? [to, from] : [from, to];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → that day at local midnight. */
export const isoToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A local day → 'YYYY-MM-DD'. */
export const dateToIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const dayFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

/** '2026-11-06', '2026-11-13' → "6–13 лист. 2026 р."; one day, or an open end, shows one date. */
export function formatDateRange(from: string, to: string): string {
  if (!from && !to) return '';
  if (!from || !to || from === to) return dayFormat.format(isoToDate(from || to));
  const [a, b] = orderedRange(from, to);
  return dayFormat.formatRange(isoToDate(a), isoToDate(b));
}
