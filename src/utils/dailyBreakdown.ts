import type { Donation, Withdrawal } from '../types';

export interface DayRow {
  /** YYYY-MM-DD on the user's clock; for a grouped week, its first day */
  key: string;
  /** a grouped week's last day */
  endKey?: string;
  amount: number;
  count: number;
  withdrawn: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key: string, n: number) => {
  const d = parseKey(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
export const daysBetween = (from: string, to: string) => Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 86_400_000) + 1;
/** "5.03" */
export const shortKey = (key: string) => {
  const [, m, d] = key.split('-').map(Number);
  return `${d}.${pad(m)}`;
};

/** Every day of the range, the empty ones too. */
export function daysInRange(donations: Donation[], withdrawals: Withdrawal[], from: string, to: string): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (let key = from; key <= to; key = addDays(key, 1)) rows.set(key, { key, amount: 0, count: 0, withdrawn: 0 });
  for (const d of donations) {
    const row = rows.get(dayKey(d.timestamp));
    if (row) {
      row.amount += d.amount;
      row.count += 1;
    }
  }
  for (const w of withdrawals) {
    const row = rows.get(dayKey(w.timestamp));
    if (row) row.withdrawn += w.amount;
  }
  return [...rows.values()];
}

/** A long range reads better in weeks: seven days to a bar, counted from its first day. */
export function groupWeeks(days: DayRow[]): DayRow[] {
  const weeks: DayRow[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const part = days.slice(i, i + 7);
    weeks.push({
      key: part[0].key,
      endKey: part[part.length - 1].key,
      amount: part.reduce((sum, d) => sum + d.amount, 0),
      count: part.reduce((sum, d) => sum + d.count, 0),
      withdrawn: part.reduce((sum, d) => sum + d.withdrawn, 0),
    });
  }
  return weeks;
}

export interface RangeSummary {
  amount: number;
  count: number;
  avg: number;
  activeDays: number;
  best: DayRow | null;
}

export function summarize(days: DayRow[]): RangeSummary {
  const amount = days.reduce((sum, d) => sum + d.amount, 0);
  const count = days.reduce((sum, d) => sum + d.count, 0);
  const active = days.filter((d) => d.count > 0);
  const best = active.reduce<DayRow | null>((top, d) => (!top || d.amount > top.amount ? d : top), null);
  return { amount, count, avg: count > 0 ? amount / count : 0, activeDays: active.length, best };
}

/** The period of the same length right before the range. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** Change against the previous period, in percent; null when there is nothing to compare with. */
export const changePct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export interface DayDetail {
  amount: number;
  count: number;
  avg: number;
  biggest: Donation | null;
  uniqueDonors: number;
  first: Date | null;
  last: Date | null;
  /** raised per hour of the day, 0..23 */
  byHour: number[];
  peakHour: number | null;
  activeHours: number;
  withdrawals: Withdrawal[];
  comments: Donation[];
}

export function dayDetail(donations: Donation[], withdrawals: Withdrawal[], key: string): DayDetail {
  const list = donations.filter((d) => dayKey(d.timestamp) === key).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const d of list) byHour[d.timestamp.getHours()] += d.amount;
  const amount = list.reduce((sum, d) => sum + d.amount, 0);
  const peak = Math.max(...byHour);
  return {
    amount,
    count: list.length,
    avg: list.length ? amount / list.length : 0,
    biggest: list.reduce<Donation | null>((top, d) => (!top || d.amount > top.amount ? d : top), null),
    uniqueDonors: new Set(list.filter((d) => d.donor).map((d) => d.donor)).size,
    first: list[0]?.timestamp ?? null,
    last: list[list.length - 1]?.timestamp ?? null,
    byHour,
    peakHour: peak > 0 ? byHour.indexOf(peak) : null,
    activeHours: byHour.filter((v) => v > 0).length,
    withdrawals: withdrawals.filter((w) => dayKey(w.timestamp) === key),
    comments: list.filter((d) => d.comment),
  };
}

/** Raised per weekday (Monday first) and hour over a range. */
export function weekHourGrid(donations: Donation[], from: string, to: string): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const d of donations) {
    const key = dayKey(d.timestamp);
    if (key < from || key > to) continue;
    grid[(d.timestamp.getDay() + 6) % 7][d.timestamp.getHours()] += d.amount;
  }
  return grid;
}

/** The running total across a range, counting everything raised before it. */
export function cumulativePoints(donations: Donation[], days: DayRow[]): Array<{ date: string; total: number }> {
  if (days.length === 0) return [];
  let total = donations.filter((d) => dayKey(d.timestamp) < days[0].key).reduce((sum, d) => sum + d.amount, 0);
  return days.map((d) => ({ date: d.key, total: (total += d.amount) }));
}
