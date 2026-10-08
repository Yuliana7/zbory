import type { FriendJar } from '../types';
import { generateId } from './id';

export interface FriendStats {
  /** helpers worth listing — raised something, or have a target to work towards — biggest first */
  ranked: FriendJar[];
  /** sum of what helpers raised — a share OF the main total, never added to it */
  total: number;
  /** total / mainTotal, clamped to 0..1 */
  share: number;
  /** helpers claim more than the whole jar — almost certainly a typo */
  exceedsTotal: boolean;
  /** how many helpers have a target, and how many of them reached it */
  withTarget: number;
  reached: number;
}

export function newFriend(): FriendJar {
  return { id: generateId(), name: '', raised: 0 };
}

/** A helper's progress against its own target. `pct` is null without a target and can be well over 100. */
export function friendProgress(f: FriendJar): { pct: number | null; reached: boolean } {
  if (!f.target || f.target <= 0) return { pct: null, reached: false };
  const pct = (f.raised / f.target) * 100;
  return { pct, reached: pct >= 100 };
}

export function computeFriendStats(friends: FriendJar[] | undefined, mainTotal: number): FriendStats {
  const all = friends ?? [];
  const ranked = all.filter((f) => f.raised > 0 || (f.target ?? 0) > 0).sort((a, b) => b.raised - a.raised);
  const total = all.reduce((sum, f) => sum + (f.raised > 0 ? f.raised : 0), 0);
  const targeted = ranked.filter((f) => friendProgress(f).pct !== null);
  return {
    ranked,
    total,
    share: mainTotal > 0 ? Math.min(1, total / mainTotal) : 0,
    exceedsTotal: mainTotal > 0 && total > mainTotal,
    withTarget: targeted.length,
    reached: targeted.filter((f) => friendProgress(f).reached).length,
  };
}

export interface FriendBar {
  /** target: against the helper's own target · relative: against the biggest helper (when nobody has a
   * target) · none: no bar, just the amount */
  mode: 'target' | 'relative' | 'none';
  /** 0..1 — how much of the bar is filled (capped: a helper at 142% has a full bar) */
  fill: number;
  /** the real percentage of the target, may exceed 100; null without a target */
  pct: number | null;
  reached: boolean;
}

/**
 * How a helper's bar should look among the helpers being listed. With a target it is progress
 * towards that target. Before anyone has set a target, bars keep their old meaning (relative to
 * the biggest helper) so existing data looks as it did. Once some helpers have targets, one
 * without a target gets no bar: a relative bar next to target bars would read as progress.
 */
export function friendBar(f: FriendJar, listed: FriendJar[]): FriendBar {
  const { pct, reached } = friendProgress(f);
  if (pct !== null) return { mode: 'target', fill: Math.min(1, pct / 100), pct, reached };
  if (listed.some((x) => friendProgress(x).pct !== null)) return { mode: 'none', fill: 0, pct: null, reached: false };
  const top = Math.max(...listed.map((x) => x.raised), 0);
  return { mode: 'relative', fill: top > 0 ? f.raised / top : 0, pct: null, reached: false };
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
    .filter((f) => f.name !== '' || f.raised > 0 || (f.target ?? 0) > 0);
}

/** The helpers a card should show: everything listed, minus the ones the user switched off for that card. */
export function visibleFriends(ranked: FriendJar[], hiddenIds: string[] | undefined): FriendJar[] {
  if (!hiddenIds?.length) return ranked;
  const hidden = new Set(hiddenIds);
  return ranked.filter((f) => !hidden.has(f.id));
}

/** "<1" instead of a misleading 0 when helpers raised a sliver of the total. */
export function formatSharePct(share: number): string {
  const pct = share * 100;
  return pct > 0 && pct < 1 ? '<1' : String(Math.round(pct));
}

/** A helper row as typed in the editor (amounts are still text). */
export interface FriendDraftRow {
  id: string;
  name: string;
  raised: string;
  target: string;
}

export const friendsToRows = (friends: FriendJar[] | undefined): FriendDraftRow[] =>
  (friends ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    raised: f.raised ? String(f.raised) : '',
    target: f.target ? String(f.target) : '',
  }));

/** Typed rows → clean helpers, exactly what gets stored. */
export function rowsToFriends(rows: FriendDraftRow[]): FriendJar[] {
  return cleanFriends(
    rows.map((r) => {
      const target = parseAmount(r.target);
      return { id: r.id, name: r.name, raised: parseAmount(r.raised) ?? 0, ...(target ? { target } : null) };
    }),
  );
}

/** Do the typed rows differ from what is stored? (Blank rows don't count — they'd be dropped.) */
export function friendsDiffer(rows: FriendDraftRow[], saved: FriendJar[] | undefined): boolean {
  const norm = (list: FriendJar[]) => JSON.stringify(list.map((f) => [f.id, f.name, f.raised, f.target ?? null]));
  return norm(rowsToFriends(rows)) !== norm(cleanFriends(saved ?? []));
}

/** Names are the helpers' identity: compared ignoring case and extra spaces. */
export const friendNameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Ids of rows whose name is also used by another row (blank names never clash). */
export function duplicateNameIds(rows: FriendDraftRow[]): Set<string> {
  const byName = new Map<string, string[]>();
  for (const r of rows) {
    const key = friendNameKey(r.name);
    if (key) byName.set(key, [...(byName.get(key) ?? []), r.id]);
  }
  return new Set([...byName.values()].filter((ids) => ids.length > 1).flat());
}
