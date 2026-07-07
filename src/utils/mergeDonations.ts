import type { RawDonation } from '../types';
import { parseUkrainianDate } from './csvParser';

// Merging statement files: long campaigns get exported in chunks, often with
// overlapping periods. Two rows are the same operation when date, amount and
// resulting balance all match — two real donations in the same minute for the
// same amount still differ in Залишок.

export interface MergeResult {
  merged: RawDonation[]; // newest-first, like a Monobank CSV
  added: number;
  duplicates: number;
}

const rowKey = (r: RawDonation) => `${r.date.trim()}|${r.amount.trim()}|${r.balance.trim()}`;

export function mergeRawDonations(existing: RawDonation[], incoming: RawDonation[]): MergeResult {
  const seen = new Set(existing.map(rowKey));
  const merged = [...existing];
  let added = 0;

  for (const row of incoming) {
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    added += 1;
  }

  merged.sort(
    (a, b) => (parseUkrainianDate(b.date)?.getTime() ?? 0) - (parseUkrainianDate(a.date)?.getTime() ?? 0),
  );

  return { merged, added, duplicates: incoming.length - added };
}
