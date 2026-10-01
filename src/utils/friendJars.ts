import type { FriendJar } from '../types';
import { generateId } from './id';

export interface FriendStats {
  /** helpers with a positive amount, biggest first */
  ranked: FriendJar[];
  /** sum of what helpers raised — a share OF the main total, never added to it */
  total: number;
  /** total / mainTotal, clamped to 0..1 */
  share: number;
  /** helpers claim more than the whole jar — almost certainly a typo */
  exceedsTotal: boolean;
}

export function newFriend(): FriendJar {
  return { id: generateId(), name: '', raised: 0 };
}

export function computeFriendStats(friends: FriendJar[] | undefined, mainTotal: number): FriendStats {
  const ranked = (friends ?? []).filter((f) => f.raised > 0).sort((a, b) => b.raised - a.raised);
  const total = ranked.reduce((sum, f) => sum + f.raised, 0);
  return {
    ranked,
    total,
    share: mainTotal > 0 ? Math.min(1, total / mainTotal) : 0,
    exceedsTotal: mainTotal > 0 && total > mainTotal,
  };
}

/** Parses a typed amount ("1 500", "1500,50") — null for empty/invalid/non-positive. */
export function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Drops rows the user left blank so templates and storage never see them. */
export function cleanFriends(friends: FriendJar[]): FriendJar[] {
  return friends
    .map((f) => ({ ...f, name: f.name.trim() }))
    .filter((f) => f.name !== '' || f.raised > 0);
}

/** "<1" instead of a misleading 0 when helpers raised a sliver of the total. */
export function formatSharePct(share: number): string {
  const pct = share * 100;
  return pct > 0 && pct < 1 ? '<1' : String(Math.round(pct));
}
