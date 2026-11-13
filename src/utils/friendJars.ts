import type { FriendJar, FriendSnapshot } from '../types';
import { generateId } from './id';
import type { PublicJar } from './monobankJar';

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
  /** what the helpers together set out to raise: every helper's target, and for one without a target
   * its own amount (so it neither inflates nor drags the combined progress) */
  targetsTotal: number;
  /** total / targetsTotal as a fraction, may pass 1; null when no helper has a real target */
  targetsProgress: number | null;
  /** helpers counted at their own amount because they have no target */
  withoutTarget: number;
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
  const counted = all.filter((f) => f.raised > 0 || (f.target ?? 0) > 0);
  const targetsTotal = counted.reduce((sum, f) => sum + ((f.target ?? 0) > 0 ? f.target! : f.raised), 0);
  return {
    ranked,
    total,
    share: mainTotal > 0 ? Math.min(1, total / mainTotal) : 0,
    exceedsTotal: mainTotal > 0 && total > mainTotal,
    withTarget: targeted.length,
    reached: targeted.filter((f) => friendProgress(f).reached).length,
    targetsTotal,
    targetsProgress: targeted.length > 0 && targetsTotal > 0 ? total / targetsTotal : null,
    withoutTarget: counted.filter((f) => !((f.target ?? 0) > 0)).length,
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
    .filter((f) => f.name !== '' || f.raised > 0 || (f.target ?? 0) > 0 || !!f.jarId);
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
  /** the helper's own jar (Monobank long id), once linked */
  jarId?: string;
  /** the id in the jar's share link */
  shortId?: string;
  /** the linked jar is closed: the row is read-only */
  closed?: boolean;
  parentJar?: string;
  updatedAt?: number;
  syncedAt?: number;
  history?: FriendSnapshot[];
}

export const friendsToRows = (friends: FriendJar[] | undefined): FriendDraftRow[] =>
  (friends ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    raised: f.raised ? String(f.raised) : '',
    target: f.target ? String(f.target) : '',
    jarId: f.jarId,
    shortId: f.shortId,
    closed: f.closed,
    parentJar: f.parentJar,
    updatedAt: f.updatedAt,
    syncedAt: f.syncedAt,
    history: f.history,
  }));

/** How many points a helper's history keeps (one a day at most, so over a year). */
const HISTORY_LIMIT = 400;

/**
 * A helper's history after seeing `raised`. A point is added only when the amount changed, one per day
 * (a later change that day replaces it); a helper with no history starts from what was known before,
 * so the first change already has something to compare with.
 */
export function nextHistory(old: FriendJar | undefined, history: FriendSnapshot[] | undefined, raised: number, now: number): FriendSnapshot[] {
  const base = history ?? (old ? [{ at: old.syncedAt ?? old.updatedAt ?? now, raised: old.raised }] : []);
  const last = base[base.length - 1];
  if (last && last.raised === raised) return base;
  const point = { at: now, raised };
  const sameDay = last && base.length > 1 && new Date(last.at).toDateString() === new Date(now).toDateString();
  return [...(sameDay ? base.slice(0, -1) : base), point].slice(-HISTORY_LIMIT);
}

/**
 * Typed rows → clean helpers, exactly what gets stored. `updatedAt` moves to `now` only for a helper
 * whose name, amount, target or status differs from `prev` (or is new); a refresh that finds nothing
 * new leaves it alone, so "latest modified" means what it says.
 */
export function rowsToFriends(rows: FriendDraftRow[], prev: FriendJar[] = [], now: number = Date.now()): FriendJar[] {
  const before = new Map(prev.map((f) => [f.id, f]));
  return cleanFriends(
    rows.map((r) => {
      const target = parseAmount(r.target);
      const f: FriendJar = {
        id: r.id,
        name: r.name,
        raised: parseAmount(r.raised) ?? 0,
        ...(target ? { target } : null),
        ...(r.jarId ? { jarId: r.jarId } : null),
        ...(r.shortId ? { shortId: r.shortId } : null),
        ...(r.closed ? { closed: true } : null),
        ...(r.parentJar ? { parentJar: r.parentJar } : null),
        ...(r.syncedAt ? { syncedAt: r.syncedAt } : null),
      };
      const old = before.get(r.id);
      const same =
        old && old.name.trim() === f.name.trim() && old.raised === f.raised && (old.target ?? 0) === (f.target ?? 0) && !!old.closed === !!f.closed;
      const updatedAt = same ? (old.updatedAt ?? r.updatedAt) : now;
      const history = nextHistory(old, old?.history ?? r.history, f.raised, now);
      return { ...f, ...(updatedAt ? { updatedAt } : null), history };
    }),
  );
}

/** Do the typed rows differ from what is stored? Blank rows don't count (they'd be dropped) and neither
 * does the order, which is only a view of the list. */
export function friendsDiffer(rows: FriendDraftRow[], saved: FriendJar[] | undefined): boolean {
  const norm = (list: FriendJar[]) =>
    JSON.stringify(
      list
        .map((f) => [f.id, f.name, f.raised, f.target ?? null, f.jarId ?? null, !!f.closed])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  return norm(rowsToFriends(rows)) !== norm(cleanFriends(saved ?? []));
}

export type RowChange = 'new' | 'changed';

/** Which rows differ from `before` (the list as it was when the editor opened): added ones, and ones
 * whose name, amount, target, status or linked jar changed. Blank new rows count too, so a row that was
 * just added is easy to find. */
export function rowChanges(rows: FriendDraftRow[], before: FriendJar[]): Map<string, RowChange> {
  const old = new Map(before.map((f) => [f.id, f]));
  const out = new Map<string, RowChange>();
  for (const r of rows) {
    const o = old.get(r.id);
    if (!o) {
      out.set(r.id, 'new');
      continue;
    }
    const same =
      o.name.trim() === r.name.trim() &&
      o.raised === (parseAmount(r.raised) ?? 0) &&
      (o.target ?? 0) === (parseAmount(r.target) ?? 0) &&
      !!o.closed === !!r.closed &&
      (o.jarId ?? '') === (r.jarId ?? '');
    if (!same) out.set(r.id, 'changed');
  }
  return out;
}

/** The helpers whose jar is closed and that raised something, biggest first — the closed-jars card's list. */
export const closedFriends = (friends: FriendJar[]) =>
  friends.filter((f) => f.closed && f.raised > 0).sort((a, b) => b.raised - a.raised);

/** Where a helper stands. Only a linked jar can be known to be closed; every other one counts as open. */
export const isClosed = (f: { closed?: boolean }) => !!f.closed;

export type FriendSortKey = 'modified' | 'name' | 'raised' | 'status';

/**
 * Sorts helpers for the read-only list: by last change (newest first; never-changed ones last), by name
 * (А→Я), by amount (biggest first) or by status (open first). Ties fall back to the name so the order is
 * stable; `desc` flips it.
 */
export function sortFriends(friends: FriendJar[], key: FriendSortKey, desc = false): FriendJar[] {
  const byName = (a: FriendJar, b: FriendJar) => a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' });
  const cmp: Record<FriendSortKey, (a: FriendJar, b: FriendJar) => number> = {
    modified: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || b.raised - a.raised || byName(a, b),
    name: byName,
    raised: (a, b) => b.raised - a.raised || byName(a, b),
    status: (a, b) => Number(isClosed(a)) - Number(isClosed(b)) || byName(a, b),
  };
  const out = [...friends].sort(cmp[key]);
  return desc ? out.reverse() : out;
}

/** The link people open to donate to a jar. */
export const jarShareLink = (shortId: string) => `https://send.monobank.ua/jar/${shortId}`;

export const fmtUah = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** how many helpers the analytics page previews */
export const FRIENDS_PREVIEW = 5;
export const FRIENDS_PAGE_SIZE = 10;

/** Helpers by last change, newest first (never-changed ones last, biggest first). */
export const latestModified = (friends: FriendJar[]) => sortFriends(friends, 'modified');

export function pageOf<T>(list: T[], page: number, size = FRIENDS_PAGE_SIZE): { items: T[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { items: list.slice(p * size, (p + 1) * size), pages, page: p };
}

/**
 * What a freshly read jar changes in a row: always the amount and the closed flag; the jar's own goal
 * only when the row has no target yet, and the owner's name (else the jar's title) only when the row has no name — whatever the user
 * typed is theirs.
 */
export function applyJarInfo(row: FriendDraftRow, jar: PublicJar, now: number): FriendDraftRow {
  return {
    ...row,
    raised: jar.raised > 0 ? String(jar.raised) : '',
    target: row.target.trim() === '' && jar.goal ? String(jar.goal) : row.target,
    // the owner's name is who the helper is; the jar's title is only a fallback
    name: row.name.trim() === '' ? jar.ownerName || jar.title : row.name,
    closed: jar.closed,
    shortId: jar.shortId ?? row.shortId,
    syncedAt: now,
  };
}

export type HelperProblem = 'not-helper' | 'other-main' | null;

/**
 * Whether a jar can be a helper of this project. Every helper jar names the main jar it feeds, so one
 * that names none isn't a helper, and one that names another jar belongs to another fundraiser. The
 * project's main jar is known when it came from Monobank; otherwise the helpers it has stand in for it.
 */
export function helperProblem(parentJar: string | undefined, mainShortId: string | undefined, rows: Array<{ parentJar?: string }>): HelperProblem {
  if (!parentJar) return 'not-helper';
  const expected = mainShortId ?? usualParentJar(rows);
  return expected && parentJar !== expected ? 'other-main' : null;
}

/** The main jar most of the helpers feed: what a newly added jar should match. */
export function usualParentJar(rows: Array<{ parentJar?: string }>): string | undefined {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.parentJar) counts.set(r.parentJar, (counts.get(r.parentJar) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
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

const csvField = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const pad2 = (n: number) => String(n).padStart(2, '0');
const localStamp = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** The helper list as CSV (comma separated, text quoted, UTF-8 — Excel gets a BOM from downloadCSV).
 * Times are on the user's own clock. */
export function friendsToCSV(friends: FriendJar[]): string {
  const head = ['Назва', 'Зібрано, ₴', 'Ціль, ₴', 'Відсоток цілі', 'Статус', 'ID банки', 'Посилання', 'Остання зміна', 'Оновлено з Monobank'];
  const lines = friends.map((f) => {
    const { pct } = friendProgress(f);
    return [
      csvField(f.name),
      f.raised.toFixed(2),
      f.target ? f.target.toFixed(2) : '',
      pct === null ? '' : String(Math.round(pct)),
      csvField(f.closed ? 'Закрита' : 'Відкрита'),
      csvField(f.jarId ?? ''),
      csvField(f.shortId ? jarShareLink(f.shortId) : ''),
      f.updatedAt ? csvField(localStamp(f.updatedAt)) : '',
      f.syncedAt ? csvField(localStamp(f.syncedAt)) : '',
    ].join(',');
  });
  return [head.map(csvField).join(','), ...lines].join('\n');
}
