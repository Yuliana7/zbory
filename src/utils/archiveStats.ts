import type { Aggregates, Donation } from '../types';
import type { CampaignMeta } from './campaignStore';
import { isAnonymousDonor, normalizeDonorKey } from './dataAggregator';
import { SELF_DONATION } from './csvParser';

/** The story of a finished project, from its statement: how it grew, who gave, when. Shared by the
 * archive page and the «Підсумок» cards. Donor names come from the statement's «Від:» field, so
 * anything about returning donors is approximate (two people with one name are one donor). */

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const noon = (key: string) => new Date(`${key}T12:00:00`).getTime();
/** whole days between two YYYY-MM-DD keys (DST-safe: noon to noon, rounded) */
export const daysApart = (from: string, to: string) => Math.round((noon(to) - noon(from)) / 864e5);

/** The days a statement covers, first to last, both counted. */
export const statementDays = (a: Aggregates) => Math.max(1, Math.round((a.lastDate.getTime() - a.firstDate.getTime()) / 864e5) + 1);

// ─── Growth ───────────────────────────────────────────────────────────────────

export interface Milestone {
  pct: number;
  /** the day the running total reached it (YYYY-MM-DD) */
  date: string;
  /** which day of the project it was, the first day being 1 */
  day: number;
}

export const MILESTONE_PCTS = [25, 50, 75, 100];

/** When the running total crossed each quarter of `target` (the goal, or the final total when there
 * was none). Quarters never reached are left out. */
export function milestones(cumulative: Aggregates['cumulative'], target: number): Milestone[] {
  if (!cumulative.length || target <= 0) return [];
  const first = cumulative[0].date;
  const out: Milestone[] = [];
  for (const pct of MILESTONE_PCTS) {
    const hit = cumulative.find((c) => c.total >= (target * pct) / 100 - 0.005);
    if (hit) out.push({ pct, date: hit.date, day: daysApart(first, hit.date) + 1 });
  }
  return out;
}

export interface BestMoments {
  bestDay: { date: string; amount: number } | null;
  /** the single clock hour that brought the most (a date and an hour 0–23) */
  bestHour: { date: string; hour: number; amount: number } | null;
  /** the longest run of consecutive days with at least one donation */
  streak: { days: number; from: string; to: string };
}

export function bestMoments(donations: Donation[]): BestMoments {
  const byDay = new Map<string, number>();
  const byHour = new Map<string, number>();
  for (const d of donations) {
    const day = dayKey(d.timestamp);
    byDay.set(day, (byDay.get(day) ?? 0) + d.amount);
    const hour = `${day}|${d.timestamp.getHours()}`;
    byHour.set(hour, (byHour.get(hour) ?? 0) + d.amount);
  }
  let bestDay: BestMoments['bestDay'] = null;
  for (const [date, amount] of byDay) if (!bestDay || amount > bestDay.amount) bestDay = { date, amount };
  let bestHour: BestMoments['bestHour'] = null;
  for (const [key, amount] of byHour) {
    if (bestHour && amount <= bestHour.amount) continue;
    const [date, hour] = key.split('|');
    bestHour = { date, hour: Number(hour), amount };
  }
  const days = [...byDay.keys()].sort();
  let streak = { days: 0, from: '', to: '' };
  let runFrom = days[0];
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && daysApart(days[i - 1], days[i]) !== 1) runFrom = days[i];
    const len = daysApart(runFrom, days[i]) + 1;
    if (len > streak.days) streak = { days: len, from: runFrom, to: days[i] };
  }
  return { bestDay, bestHour, streak };
}

export interface Rhythm {
  /** money by weekday, Monday first */
  weekdays: number[];
  /** money by clock hour, 0–23 */
  hours: number[];
  bestWeekday: number;
  bestHour: number;
}

/** When people gave: which weekday and which hour of the day brought the most money, all days together. */
export function rhythm(donations: Donation[]): Rhythm {
  const weekdays = Array<number>(7).fill(0);
  const hours = Array<number>(24).fill(0);
  for (const d of donations) {
    weekdays[(d.timestamp.getDay() + 6) % 7] += d.amount;
    hours[d.timestamp.getHours()] += d.amount;
  }
  const argmax = (xs: number[]) => xs.reduce((best, v, i) => (v > xs[best] ? i : best), 0);
  return { weekdays, hours, bestWeekday: argmax(weekdays), bestHour: argmax(hours) };
}

// ─── Supporters ───────────────────────────────────────────────────────────────

export type SizeBandKey = 'small' | 'medium' | 'large';

export interface SizeBand {
  key: SizeBandKey;
  count: number;
  amount: number;
  /** of all donations, 0–1 */
  countShare: number;
  /** of all the money, 0–1 */
  amountShare: number;
}

/** Donations under 100 ₴, 100–1000 ₴ and over 1000 ₴ (the same bands as the analytics): how many, and how much money. */
export function sizeBands(donations: Donation[]): SizeBand[] {
  const bands: Record<SizeBandKey, { count: number; amount: number }> = {
    small: { count: 0, amount: 0 },
    medium: { count: 0, amount: 0 },
    large: { count: 0, amount: 0 },
  };
  let total = 0;
  for (const d of donations) {
    const band = d.amount < 100 ? bands.small : d.amount <= 1000 ? bands.medium : bands.large;
    band.count += 1;
    band.amount += d.amount;
    total += d.amount;
  }
  const n = donations.length || 1;
  return (['small', 'medium', 'large'] as const).map((key) => ({
    key,
    ...bands[key],
    countShare: bands[key].count / n,
    amountShare: total ? bands[key].amount / total : 0,
  }));
}

export interface Supporter {
  name: string;
  count: number;
  amount: number;
}

export interface Loyalty {
  /** donors known by name (anonymous donations have none) */
  named: number;
  anonymous: number;
  /** named donors who gave two or more times */
  returning: number;
  /** of all the money, 0–1 */
  returningShare: number;
  /** the donor who gave most often (ties: the bigger total) */
  mostLoyal: Supporter | null;
  /** the five who gave the most */
  top: Supporter[];
}

/** Who gave, by the names in the statement. The jar owner's own top-ups count in the money, not as a donor. */
export function loyalty(donations: Donation[]): Loyalty {
  const people = new Map<string, Supporter>();
  let anonymous = 0;
  let total = 0;
  for (const d of donations) {
    total += d.amount;
    if (d.donor === SELF_DONATION) continue;
    if (isAnonymousDonor(d.donor)) {
      anonymous += 1;
      continue;
    }
    const key = normalizeDonorKey(d.donor!);
    const p = people.get(key);
    if (p) {
      p.count += 1;
      p.amount += d.amount;
    } else people.set(key, { name: d.donor!.trim(), count: 1, amount: d.amount });
  }
  const all = [...people.values()];
  const back = all.filter((p) => p.count >= 2);
  const mostLoyal = [...back].sort((a, b) => b.count - a.count || b.amount - a.amount)[0] ?? null;
  return {
    named: all.length,
    anonymous,
    returning: back.length,
    returningShare: total ? back.reduce((s, p) => s + p.amount, 0) / total : 0,
    mostLoyal,
    top: [...all].sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

// ─── Against the other closed projects ────────────────────────────────────────

export interface Comparison {
  /** this total ÷ the others' average total */
  ratio: number;
  others: number;
  /** this project's days minus the others' average days (negative: shorter) */
  dayDiff: number;
}

const metaDays = (m: CampaignMeta) =>
  m.summary.firstDate && m.summary.lastDate ? daysApart(m.summary.firstDate, m.summary.lastDate) + 1 : 0;

/** How a closed project did next to the user's other closed projects. Null when there are none to compare with. */
export function compareToOthers(self: CampaignMeta, archived: CampaignMeta[]): Comparison | null {
  const others = archived.filter((m) => m.id !== self.id && m.summary.totalAmount > 0);
  if (others.length === 0) return null;
  const avgTotal = others.reduce((s, m) => s + m.summary.totalAmount, 0) / others.length;
  const avgDays = others.reduce((s, m) => s + metaDays(m), 0) / others.length;
  return { ratio: self.summary.totalAmount / avgTotal, others: others.length, dayDiff: Math.round(metaDays(self) - avgDays) };
}
