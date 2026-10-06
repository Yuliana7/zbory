import type { RawDonation } from '../types';
import { parseUkrainianDate } from './csvParser';

// Merging statements: long campaigns come in chunks (several CSV exports, or a CSV
// plus a fetch from the Monobank API), often with overlapping periods. Two rows
// are the same operation when their time (to the minute), amount and resulting
// balance (Залишок) all match — two real donations in the same minute for the
// same amount still differ in Залишок.
//
// Matching is on parsed values, not on the raw strings, because the same
// operation is written differently by different sources ("333.00" / "333,00",
// "12:26" / "12:26:41"). And it copes with a consistent time offset between two
// sources (e.g. one exports UTC, the other local time): see matchWithTimeShift.

export interface MergeResult {
  merged: RawDonation[]; // newest-first, like a Monobank CSV
  added: number;
  duplicates: number;
  /** minutes the existing rows lead the incoming ones when the two sources use different clocks; null = same clock */
  timeShiftMinutes: number | null;
  /** new rows land inside the period we already have, yet none of them matched anything — likely the same donations written differently */
  suspectedOverlap: boolean;
}

interface Parsed {
  minute: number | null; // minutes since epoch (seconds ignored)
  cents: number | null;
  balance: number | null; // cents
}

const toCents = (raw: string): number | null => {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const parse = (r: RawDonation): Parsed => {
  const t = parseUkrainianDate(r.date.trim())?.getTime();
  return {
    minute: t === undefined || Number.isNaN(t) ? null : Math.floor(t / 60000),
    cents: toCents(r.amount),
    balance: toCents(r.balance),
  };
};

/** Identity of an operation; rows that can't be parsed fall back to their raw text. */
const exactKey = (p: Parsed, r: RawDonation) =>
  p.minute !== null && p.cents !== null && p.balance !== null
    ? `${p.minute}|${p.cents}|${p.balance}`
    : `raw:${r.date.trim()}|${r.amount.trim()}|${r.balance.trim()}`;

/** Amount + resulting balance: strong enough to pair rows once their clocks are reconciled. */
const amountBalanceKey = (p: Parsed) =>
  p.cents !== null && p.balance !== null && p.minute !== null ? `${p.cents}|${p.balance}` : null;

const MAX_SHIFT_MINUTES = 14 * 60;
const SHIFT_TOLERANCE_MINUTES = 1;

/**
 * Second pass for rows the exact pass couldn't pair. If many leftover rows share
 * amount AND balance with a leftover existing row, and their times differ by the
 * same amount every time, the two sources simply keep different clocks — those
 * rows are the same operations. Needs at least two agreeing pairs covering half
 * of the candidates, so a single coincidence is never treated as a duplicate.
 */
function matchWithTimeShift(
  existing: Parsed[],
  incoming: Parsed[],
  freeExisting: Set<number>,
  freeIncoming: Set<number>,
): { pairs: Array<[number, number]>; shift: number } | null {
  const existingByKey = new Map<string, number[]>();
  for (const i of freeExisting) {
    const key = amountBalanceKey(existing[i]);
    if (key) (existingByKey.get(key) ?? existingByKey.set(key, []).get(key)!).push(i);
  }

  const histogram = new Map<number, number>();
  let candidates = 0;
  for (const j of freeIncoming) {
    const key = amountBalanceKey(incoming[j]);
    const matches = key ? existingByKey.get(key) : undefined;
    if (!matches?.length) continue;
    candidates += 1;
    for (const i of matches) {
      const shift = existing[i].minute! - incoming[j].minute!;
      if (Math.abs(shift) <= MAX_SHIFT_MINUTES) histogram.set(shift, (histogram.get(shift) ?? 0) + 1);
    }
  }
  if (histogram.size === 0) return null;

  const [shift, count] = [...histogram.entries()].sort((a, b) => b[1] - a[1])[0];
  if (shift === 0 || count < 2 || count < Math.ceil(candidates / 2)) return null;

  const pairs: Array<[number, number]> = [];
  const taken = new Set<number>();
  for (const j of [...freeIncoming].sort((a, b) => incoming[b].minute! - incoming[a].minute!)) {
    const key = amountBalanceKey(incoming[j]);
    const match = key
      ? (existingByKey.get(key) ?? []).find(
          (i) =>
            !taken.has(i) &&
            Math.abs(existing[i].minute! - incoming[j].minute! - shift) <= SHIFT_TOLERANCE_MINUTES,
        )
      : undefined;
    if (match !== undefined) {
      taken.add(match);
      pairs.push([match, j]);
    }
  }
  return pairs.length >= 2 ? { pairs, shift } : null;
}

export function mergeRawDonations(existing: RawDonation[], incoming: RawDonation[]): MergeResult {
  const ex = existing.map(parse);
  const inc = incoming.map(parse);
  const freeExisting = new Set(ex.map((_, i) => i));
  const duplicateIncoming = new Set<number>();

  // Pass 1 — same time, amount and balance. Each existing row pairs with at most one
  // incoming row, so a genuinely repeated row still counts as a separate operation.
  const byKey = new Map<string, number[]>();
  ex.forEach((p, i) => {
    const key = exactKey(p, existing[i]);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(i);
  });
  inc.forEach((p, j) => {
    const i = byKey.get(exactKey(p, incoming[j]))?.shift();
    if (i === undefined) return;
    freeExisting.delete(i);
    duplicateIncoming.add(j);
  });

  // Pass 2 — the sources keep different clocks.
  let timeShiftMinutes: number | null = null;
  const freeIncoming = new Set(inc.map((_, j) => j).filter((j) => !duplicateIncoming.has(j)));
  if (freeExisting.size > 0 && freeIncoming.size > 0) {
    const shifted = matchWithTimeShift(ex, inc, freeExisting, freeIncoming);
    if (shifted) {
      timeShiftMinutes = shifted.shift;
      for (const [i, j] of shifted.pairs) {
        freeExisting.delete(i);
        duplicateIncoming.add(j);
      }
    }
  }

  const fresh = incoming.filter((_, j) => !duplicateIncoming.has(j));
  const merged = [...existing, ...fresh];
  merged.sort(
    (a, b) => (parseUkrainianDate(b.date)?.getTime() ?? 0) - (parseUkrainianDate(a.date)?.getTime() ?? 0),
  );

  // Warn when new rows fall inside the period we already cover but nothing matched at all
  const existingMinutes = ex.map((p) => p.minute).filter((m): m is number => m !== null);
  const [from, to] = [Math.min(...existingMinutes), Math.max(...existingMinutes)];
  const insideCovered = inc.filter(
    (p, j) => !duplicateIncoming.has(j) && p.minute !== null && p.minute >= from && p.minute <= to,
  ).length;
  const suspectedOverlap = existingMinutes.length > 0 && duplicateIncoming.size === 0 && insideCovered >= 3;

  return {
    merged,
    added: fresh.length,
    duplicates: incoming.length - fresh.length,
    timeShiftMinutes,
    suspectedOverlap,
  };
}
