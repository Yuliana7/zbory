import type { FriendJar } from '../types';
import { friendProgress, type FriendSortKey } from './friendJars';

const DAY_MS = 24 * 60 * 60 * 1000;
/** an open linked jar with no change for this long is worth a nudge */
export const STALLED_AFTER_DAYS = 5;
/** the pace behind the forecast is taken from this many recent days */
const PACE_WINDOW_DAYS = 14;

export type FriendFilter = 'all' | 'active' | 'reached' | 'closed' | 'stalled' | 'unlinked';
export const FRIEND_FILTERS: FriendFilter[] = ['all', 'active', 'reached', 'closed', 'stalled', 'unlinked'];
export const FRIEND_SORT_KEYS: FriendSortKey[] = ['modified', 'name', 'raised', 'status'];

export interface Growth {
  delta: number;
  /** when the compared amount is from: later than asked for if the history is shorter than that */
  since: number;
}

/** How much a helper grew over the last `days`, from its own history. Null until there are two points. */
export function growth(f: FriendJar, days: number, now: number): Growth | null {
  const h = f.history ?? [];
  if (h.length < 2) return null;
  const cutoff = now - days * DAY_MS;
  const base = [...h].reverse().find((p) => p.at <= cutoff) ?? h[0];
  return { delta: f.raised - base.raised, since: Math.max(base.at, cutoff) };
}

/** Days an open linked jar has gone without a change, once that is long enough to matter. */
export function stalledDays(f: FriendJar, now: number): number | null {
  if (f.closed || !f.jarId || friendProgress(f).reached) return null;
  const h = f.history ?? [];
  const last = h[h.length - 1]?.at ?? f.updatedAt;
  if (!last) return null;
  const days = Math.floor((now - last) / DAY_MS);
  return days >= STALLED_AFTER_DAYS ? days : null;
}

/** What is left to the target (nothing without a target or past it). */
export function leftToTarget(f: FriendJar): number {
  return f.target && f.target > f.raised ? f.target - f.raised : 0;
}

/** When the target comes within reach at the recent pace; null while there is too little to go on. */
export function forecast(f: FriendJar, now: number): number | null {
  const left = leftToTarget(f);
  if (!left || f.closed) return null;
  const g = growth(f, PACE_WINDOW_DAYS, now);
  if (!g || g.delta <= 0) return null;
  const spanDays = (now - g.since) / DAY_MS;
  if (spanDays < 3) return null;
  return now + (left / (g.delta / spanDays)) * DAY_MS;
}

export function matchesFilter(f: FriendJar, filter: FriendFilter, now: number): boolean {
  switch (filter) {
    case 'active': return !f.closed;
    case 'reached': return friendProgress(f).reached;
    case 'closed': return !!f.closed;
    case 'stalled': return stalledDays(f, now) !== null;
    case 'unlinked': return !f.jarId;
    default: return true;
  }
}

export const matchesSearch = (f: FriendJar, query: string) => f.name.toLowerCase().includes(query.trim().toLowerCase());
