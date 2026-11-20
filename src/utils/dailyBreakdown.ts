import type { Donation, Withdrawal } from '../types';

export interface DayRow {
  /** YYYY-MM-DD on the user's clock; for a grouped week, its first day */
  key: string;
  /** a grouped week's last day */
  endKey?: string;
  amount: number;
  count: number;
  withdrawn: number;
  /** of `amount`, money known only by day with no donations behind it (a friendly jar with no statement) */
  untracked?: number;
}

/** Money known only by day, with no donations behind it. */
export type DayAmount = { date: string; amount: number };

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

/** Every day of the range, the empty ones too; `extra` adds money known only by day. */
export function daysInRange(donations: Donation[], withdrawals: Withdrawal[], from: string, to: string, extra: DayAmount[] = []): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (let key = from; key <= to; key = addDays(key, 1)) rows.set(key, { key, amount: 0, count: 0, withdrawn: 0 });
  for (const e of extra) {
    const row = rows.get(e.date);
    if (row && e.amount > 0) {
      row.amount += e.amount;
      row.untracked = (row.untracked ?? 0) + e.amount;
    }
  }
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

// ─── Days, weeks, months ──────────────────────────────────────────────────────

export type BarUnit = 'day' | 'week' | 'month';

/** At most a month of day bars, about three months of week bars; anything longer reads in months. */
export const MAX_DAY_BARS = 31;
export const MAX_WEEK_DAYS = 98;

/** The bar units a range of `n` days can be shown in, finest first. Weeks need two of them to say
 * anything, months a bit over a month. */
export function unitsFor(n: number): BarUnit[] {
  const units: BarUnit[] = [];
  if (n <= MAX_DAY_BARS) units.push('day');
  if (n >= 8 && n <= MAX_WEEK_DAYS) units.push('week');
  if (n > MAX_DAY_BARS) units.push('month');
  return units;
}

const sumRows = (part: DayRow[]): DayRow => {
  const untracked = part.reduce((sum, d) => sum + (d.untracked ?? 0), 0);
  return {
    key: part[0].key,
    endKey: part[part.length - 1].key,
    amount: part.reduce((sum, d) => sum + d.amount, 0),
    count: part.reduce((sum, d) => sum + d.count, 0),
    withdrawn: part.reduce((sum, d) => sum + d.withdrawn, 0),
    ...(untracked ? { untracked } : null),
  };
};

/** The range's days as bars of `unit`: calendar weeks (Monday to Sunday) or calendar months, the first
 * and last cut to the range. */
export function groupBy(days: DayRow[], unit: BarUnit): DayRow[] {
  if (unit === 'day' || days.length === 0) return days;
  const bucketOf = (key: string) => {
    if (unit === 'month') return key.slice(0, 7);
    const d = parseKey(key);
    return addDays(key, -((d.getDay() + 6) % 7)); // that week's Monday
  };
  const out: DayRow[] = [];
  let part: DayRow[] = [];
  for (const d of days) {
    if (part.length && bucketOf(d.key) !== bucketOf(part[0].key)) {
      out.push(sumRows(part));
      part = [];
    }
    part.push(d);
  }
  if (part.length) out.push(sumRows(part));
  return out;
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
  // the average donation is of donations: money with none behind it stays out
  const donated = amount - days.reduce((sum, d) => sum + (d.untracked ?? 0), 0);
  const active = days.filter((d) => d.count > 0 || (d.untracked ?? 0) > 0);
  const best = active.reduce<DayRow | null>((top, d) => (!top || d.amount > top.amount ? d : top), null);
  return { amount, count, avg: count > 0 ? donated / count : 0, activeDays: active.length, best };
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

/** The running total across a range, counting everything raised before it (`extra` too). */
export function cumulativePoints(donations: Donation[], days: DayRow[], extra: DayAmount[] = []): Array<{ date: string; total: number }> {
  if (days.length === 0) return [];
  let total =
    donations.filter((d) => dayKey(d.timestamp) < days[0].key).reduce((sum, d) => sum + d.amount, 0) +
    extra.filter((e) => e.date < days[0].key).reduce((sum, e) => sum + e.amount, 0);
  return days.map((d) => ({ date: d.key, total: (total += d.amount) }));
}

/** A week or a month of the range: its totals (with any money known only by day), its days, its best day. */
export interface PeriodDetail {
  from: string;
  to: string;
  amount: number;
  untracked: number;
  count: number;
  avg: number;
  biggest: Donation | null;
  uniqueDonors: number;
  days: DayRow[];
  activeDays: number;
  best: DayRow | null;
  withdrawn: number;
  comments: number;
}

export function periodDetail(donations: Donation[], withdrawals: Withdrawal[], from: string, to: string, extra: DayAmount[] = []): PeriodDetail {
  const days = daysInRange(donations, withdrawals, from, to, extra);
  const list = donations.filter((d) => {
    const k = dayKey(d.timestamp);
    return k >= from && k <= to;
  });
  const s = summarize(days);
  return {
    from,
    to,
    amount: s.amount,
    untracked: days.reduce((sum, d) => sum + (d.untracked ?? 0), 0),
    count: s.count,
    avg: s.avg,
    biggest: list.reduce<Donation | null>((top, d) => (!top || d.amount > top.amount ? d : top), null),
    uniqueDonors: new Set(list.filter((d) => d.donor).map((d) => d.donor)).size,
    days,
    activeDays: s.activeDays,
    best: s.best,
    withdrawn: days.reduce((sum, d) => sum + d.withdrawn, 0),
    comments: list.filter((d) => d.comment).length,
  };
}
