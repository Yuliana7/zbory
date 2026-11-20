// «Мої дружні банки»: friendly jars the user runs for someone else's fundraiser.
//
// Monobank leaves a friendly jar out of its owner's statement, so these are tracked the way a friend's
// jar is: by link, through the public jar read (total, goal, status, no donations), with the app
// keeping its own history. Each one also follows the main jar it feeds, so cards can name it.

import type { Aggregates, CampaignDataset, FriendSnapshot, MainJarInfo, OwnJar, RawDonation } from '../types';
import type { MonoJar } from './monobankApi';
import { normalizeDonations } from './csvParser';
import { dayKey } from './dailyBreakdown';
import { getBackend } from './db';
import { friendNameKey, jarShareLink, nextHistory } from './friendJars';
import { generateId } from './id';
import { JarError, fetchPublicJar, lookupJar, parseJarRef, type FetchJarOptions, type JarErrorKind, type PublicJar } from './monobankJar';
import { readJars, STALE_AFTER_MS, type ReadOptions } from './friendsRefresh';

const STORE = 'ownJars';

export async function listOwnJars(): Promise<OwnJar[]> {
  const all = (await getBackend().getAll(STORE)) as OwnJar[];
  return sortOwnJars(all);
}

export async function saveOwnJar(jar: OwnJar): Promise<void> {
  await getBackend().put(STORE, jar);
}

export async function removeOwnJar(id: string): Promise<void> {
  await getBackend().remove(STORE, id);
}

/** Open jars first, then the newest added. */
export const sortOwnJars = (jars: OwnJar[]) =>
  [...jars].sort((a, b) => Number(!!a.closed) - Number(!!b.closed) || b.addedAt - a.addedAt);

/** When a jar last changed in any way the user can see: what a backup compares. */
export const ownJarStamp = (j: OwnJar) => Math.max(j.addedAt, j.syncedAt ?? 0, j.updatedAt ?? 0, j.archivedAt ?? 0, j.statementAddedAt ?? 0);

/** A new name for one of the user's jars. */
export async function renameOwnJar(jar: OwnJar, name: string, now: number = Date.now()): Promise<OwnJar> {
  const next: OwnJar = { ...jar, name: name.trim() || jar.name, updatedAt: now };
  await saveOwnJar(next);
  return next;
}

/** A jar with no goal: the user's word on whether it reached its goal (undefined takes it back). */
export async function setOwnJarGoalReached(jar: OwnJar, goalReached: boolean | undefined, now: number = Date.now()): Promise<OwnJar> {
  const { goalReached: _was, ...rest } = jar;
  const next: OwnJar = { ...rest, ...(goalReached === undefined ? null : { goalReached }), updatedAt: now };
  await saveOwnJar(next);
  return next;
}

/** Adds the jar's own statement, or (`null`) takes it away. */
export async function setOwnJarStatement(jar: OwnJar, rows: RawDonation[] | null, now: number = Date.now()): Promise<OwnJar> {
  const { statement: _rows, statementAddedAt: _at, ...rest } = jar;
  const next: OwnJar = rows ? { ...rest, statement: rows, statementAddedAt: now } : { ...rest, updatedAt: now };
  await saveOwnJar(next);
  return next;
}

/** The donations in a jar's statement; none when it has no statement (or one without donations). */
export const ownJarDonationCount = (jar: OwnJar) => (jar.statement ? normalizeDonations(jar.statement).donations.length : 0);

/** What a jar with no statement raised day by day, as the app saw it: each change of its amount on the
 * day it was read (the first reading carries everything raised before the app followed it), and anything
 * after the last reading on the day it was last read. */
export function ownJarDays(jar: OwnJar): Array<{ date: string; amount: number }> {
  const days = new Map<string, number>();
  const add = (at: number, amount: number) => {
    if (amount <= 0) return;
    const key = dayKey(new Date(at));
    days.set(key, (days.get(key) ?? 0) + amount);
  };
  let seen = 0;
  for (const h of [...(jar.history ?? [])].sort((a, b) => a.at - b.at)) {
    add(h.at, h.raised - seen);
    seen = Math.max(seen, h.raised);
  }
  add(jar.syncedAt ?? jar.archivedAt ?? jar.addedAt, jar.raised - seen);
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
}

/** A jar's statement as one of the datasets a set of statements is loaded from (the year's cards). */
export const ownJarDataset = (jar: OwnJar): CampaignDataset | null =>
  jar.statement && ownJarDonationCount(jar) > 0 ? { id: `own:${jar.id}`, name: jar.name || '—', rawData: jar.statement } : null;

/** Moves a jar to the archive, or (`null`) back to the active ones. */
export async function setOwnJarArchived(jar: OwnJar, archivedAt: number | null, now: number = Date.now()): Promise<OwnJar> {
  const { archivedAt: _was, ...rest } = jar;
  const next: OwnJar = archivedAt ? { ...rest, archivedAt } : { ...rest, updatedAt: now };
  await saveOwnJar(next);
  return next;
}

/** Brings jars from a backup in: one the device doesn't have is added, one it has is replaced only if
 * the backup's copy is newer. */
export async function restoreOwnJars(jars: OwnJar[]): Promise<{ added: number; updated: number; kept: number }> {
  const kv = getBackend();
  const result = { added: 0, updated: 0, kept: 0 };
  for (const jar of jars) {
    if (!isOwnJar(jar)) continue;
    const existing = (await kv.get(STORE, jar.id)) as OwnJar | undefined;
    if (existing && ownJarStamp(existing) >= ownJarStamp(jar)) {
      result.kept++;
      continue;
    }
    await kv.put(STORE, jar);
    result[existing ? 'updated' : 'added']++;
  }
  return result;
}

export const isOwnJar = (j: unknown): j is OwnJar => {
  const o = j as Partial<OwnJar> | null;
  return typeof o?.id === 'string' && typeof o.jarId === 'string' && typeof o.raised === 'number' && typeof o.addedAt === 'number';
};

/** What a read of the jar itself changes: the title only while the user hasn't got one, the rest always. */
export function applyOwnRead(jar: OwnJar, read: PublicJar, now: number): OwnJar {
  const changed = jar.raised !== read.raised || (jar.target ?? 0) !== (read.goal ?? 0) || !!jar.closed !== read.closed;
  const history: FriendSnapshot[] = nextHistory(jar, jar.history, read.raised, now);
  return {
    ...jar,
    name: read.title || jar.name,
    raised: read.raised,
    target: read.goal,
    closed: read.closed || undefined,
    shortId: read.shortId ?? jar.shortId,
    syncedAt: now,
    updatedAt: changed ? now : jar.updatedAt,
    history,
  };
}

export function applyMainRead(main: MainJarInfo, read: PublicJar, now: number): MainJarInfo {
  return { ...main, title: read.title, ownerName: read.ownerName, raised: read.raised, goal: read.goal, closed: read.closed, syncedAt: now };
}

export type AddOwnResult = { jar: OwnJar } | { error: JarErrorKind | 'invalid' | 'duplicate' };

/** Reads a pasted link (or long id) into a new tracked jar. The main jar is looked up too, but a jar
 * is added even when that part fails; the next renew tries again. */
export async function addOwnJar(input: string, existing: OwnJar[], opts: FetchJarOptions & { now?: number } = {}): Promise<AddOwnResult> {
  const ref = parseJarRef(input);
  if (!ref) return { error: 'invalid' };
  const now = opts.now ?? Date.now();
  try {
    let longId = ref.id;
    let mainShort: string | undefined;
    if (ref.kind === 'short') {
      const found = await lookupJar(ref.id, opts);
      longId = found.longId;
      mainShort = found.mainJar;
    }
    if (existing.some((j) => j.jarId === longId)) return { error: 'duplicate' };
    const read = await fetchPublicJar(longId, opts);
    const shortId = read.shortId ?? (ref.kind === 'short' ? ref.id : undefined);
    if (ref.kind === 'long' && shortId) {
      // a pasted long id: the main jar still has to come from our lookup
      mainShort = await lookupJar(shortId, opts).then((f) => f.mainJar, () => undefined);
    }
    const base: OwnJar = { id: generateId(), name: '', raised: 0, jarId: longId, addedAt: now };
    let jar = applyOwnRead({ ...base, shortId }, read, now);
    // the first point is the day it was added, not "before"
    jar = { ...jar, history: [{ at: now, raised: read.raised }], updatedAt: now };
    if (mainShort) jar.main = await readMain({ shortId: mainShort }, now, opts).catch(() => ({ shortId: mainShort! }));
    return { jar };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { error: err instanceof JarError ? err.kind : 'unexpected' };
  }
}

/** Adds a jar's public link to a jar known only through the user's token: from then on it can be read
 * without the token, copied, and tied to its main jar. The link is checked (our lookup) before it's kept;
 * a lookup that fails leaves the jar as it was. */
export async function attachJarLink(jar: OwnJar, input: string, others: OwnJar[], opts: FetchJarOptions & { now?: number } = {}): Promise<AddOwnResult> {
  const ref = parseJarRef(input);
  if (!ref) return { error: 'invalid' };
  const now = opts.now ?? Date.now();
  try {
    const found = ref.kind === 'short' ? await lookupJar(ref.id, opts) : null;
    const longId = found?.longId ?? ref.id;
    if (others.some((j) => j.id !== jar.id && j.jarId === longId)) return { error: 'duplicate' };
    const read = await fetchPublicJar(longId, opts);
    const shortId = read.shortId ?? (ref.kind === 'short' ? ref.id : undefined);
    const mainShort = found ? found.mainJar : shortId ? await lookupJar(shortId, opts).then((f) => f.mainJar, () => undefined) : undefined;
    let next: OwnJar = { ...jar, jarId: longId, shortId, updatedAt: now };
    if (mainShort) next.main = await readMain({ shortId: mainShort }, now, opts).catch(() => ({ shortId: mainShort }));
    // the official numbers (with the token) stay; a jar with none takes the public ones
    if (!jar.monoId) next = applyOwnRead(next, read, now);
    return { jar: next };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { error: err instanceof JarError ? err.kind : 'unexpected' };
  }
}

/** Finds the main jar's long id once (our lookup), then reads it. */
async function readMain(main: MainJarInfo, now: number, opts: FetchJarOptions): Promise<MainJarInfo> {
  const longId = main.longId ?? (await lookupJar(main.shortId, opts)).longId;
  return applyMainRead({ ...main, longId }, await fetchPublicJar(longId, opts), now);
}

export interface RenewOwnResult {
  jars: OwnJar[];
  /** how many reads failed, and the first reason */
  failed: number;
  firstError?: JarErrorKind;
  rateLimited: boolean;
}

/**
 * Reads every open jar and every main jar they feed (each main jar once, however many jars feed it),
 * all at once, with readJars' retry on "too many requests". Closed jars are final and aren't read; a
 * closed main jar isn't either. Main jars still missing a long id get it from our lookup first.
 */
export async function renewOwnJars(jars: OwnJar[], opts: ReadOptions & { now?: () => number; skip?: Set<string> } = {}): Promise<RenewOwnResult> {
  const { now = Date.now, skip, ...read } = opts;
  const mains = new Map<string, MainJarInfo>();
  // copies: the long ids found below must not be written into the caller's jars
  for (const j of jars) if (j.main && !j.closed && !j.main.closed && !mains.has(j.main.shortId)) mains.set(j.main.shortId, { ...j.main });

  let lookupError: JarErrorKind | undefined;
  for (const main of mains.values()) {
    if (main.longId || read.signal?.aborted) continue;
    try {
      main.longId = (await lookupJar(main.shortId, { fetch: read.fetch, signal: read.signal })).longId;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lookupError ??= err instanceof JarError ? err.kind : 'unexpected';
    }
  }

  const todo = [
    // only jars with a public id, and not those read another way (the user's token)
    ...jars.filter((j) => !j.closed && j.jarId && !skip?.has(j.id)).map((j) => ({ id: `own:${j.id}`, jarId: j.jarId })),
    ...[...mains.values()].filter((m) => m.longId).map((m) => ({ id: `main:${m.shortId}`, jarId: m.longId! })),
  ];
  const res = await readJars(todo, read);
  const at = now();
  const next = jars.map((j) => {
    const own = res.read.get(`own:${j.id}`);
    let out = own ? applyOwnRead(j, own, at) : j;
    if (j.main) {
      const m = mains.get(j.main.shortId);
      const mainRead = res.read.get(`main:${j.main.shortId}`);
      if (mainRead && m) out = { ...out, main: applyMainRead(m, mainRead, at) };
      else if (m?.longId && !j.main.longId) out = { ...out, main: { ...j.main, longId: m.longId } };
    }
    return out;
  });
  const errors = [...res.failed.values()];
  return {
    jars: next,
    failed: errors.length + (lookupError ? 1 : 0),
    firstError: errors[0] ?? lookupError,
    rateLimited: res.rateLimited || lookupError === 'rate-limit',
  };
}

// ─── The official way: the user's own client-info ─────────────────────────────

const kopecks = (n: number) => n / 100;

/** A friendly jar from the user's client-info, as a new tracked jar. No link: it can be added later. */
export function ownJarFromMono(mono: MonoJar, now: number): OwnJar {
  const raised = kopecks(mono.balance);
  return {
    id: generateId(),
    name: mono.title,
    raised,
    ...(mono.goal > 0 ? { target: kopecks(mono.goal) } : null),
    jarId: '',
    monoId: mono.id,
    addedAt: now,
    syncedAt: now,
    updatedAt: now,
    history: [{ at: now, raised }],
  };
}

/** What a client-info read changes: amount and goal. The name stays the user's (a jar with none takes
 * Monobank's title). Being listed means it's open. */
export function applyMonoRead(jar: OwnJar, mono: MonoJar, now: number): OwnJar {
  const raised = kopecks(mono.balance);
  const target = mono.goal > 0 ? kopecks(mono.goal) : undefined;
  const changed = jar.raised !== raised || (jar.target ?? 0) !== (target ?? 0) || !!jar.closed;
  return {
    ...jar,
    name: jar.name.trim() ? jar.name : mono.title,
    monoId: mono.id,
    raised,
    target,
    closed: undefined,
    syncedAt: now,
    updatedAt: changed ? now : jar.updatedAt,
    history: nextHistory(jar, jar.history, raised, now),
  };
}

/** A jar added by link that is probably this client-info jar: the same name (any case or spacing) and the
 * same goal. Only jars not yet tied to client-info are candidates. */
export const likelySameJar = (jar: OwnJar, mono: MonoJar) =>
  !jar.monoId && friendNameKey(jar.name) === friendNameKey(mono.title) && Math.round((jar.target ?? 0) * 100) === Math.round(mono.goal);

/** One jar from two: a jar tracked by link takes the client-info id and its numbers; its name, link,
 * main jar and history stay. */
export const mergeMonoIntoOwn = (jar: OwnJar, mono: MonoJar, now: number): OwnJar => applyMonoRead(jar, mono, now);

export interface OfficialRenewResult extends RenewOwnResult {
  /** client-info failed, so jars it should have read were read through their public links */
  fellBack: boolean;
  /** jars it should have read that have no public link either: not renewed */
  unread: OwnJar[];
  /** jars client-info no longer lists: closed (Monobank drops a closed jar from it) */
  closedNow: OwnJar[];
}

/**
 * «Оновити»: jars tied to the user's client-info are read from it in one call (`mono`); the rest through
 * their public links. When the client-info call failed (`mono` null), jars tied to it are read through
 * their public links if they have one. A tied jar client-info no longer lists has been closed: it is
 * marked so, and read once more through its link (for its final numbers) when it has one.
 */
export async function renewOwnJarsOfficial(
  jars: OwnJar[],
  mono: MonoJar[] | null,
  opts: ReadOptions & { now?: () => number } = {},
): Promise<OfficialRenewResult> {
  const now = opts.now ?? Date.now;
  const at = now();
  const byId = new Map((mono ?? []).map((m) => [m.id, m]));
  const skip = new Set<string>();
  const closedNow: OwnJar[] = [];
  const unread: OwnJar[] = [];
  const official = jars.map((j) => {
    if (!j.monoId || j.closed) return j;
    if (!mono) {
      if (!j.jarId) unread.push(j);
      return j;
    }
    const m = byId.get(j.monoId);
    if (m) {
      skip.add(j.id);
      return applyMonoRead(j, m, at);
    }
    const closed = { ...j, closed: true, updatedAt: at };
    closedNow.push(closed);
    // with a link, one more public read brings its final numbers; without, these are them
    if (!j.jarId) skip.add(j.id);
    return j.jarId ? j : closed;
  });
  const res = await renewOwnJars(official, { ...opts, now, skip });
  const closedIds = new Set(closedNow.map((j) => j.id));
  return {
    ...res,
    // a jar read publicly after leaving client-info still counts as closed
    jars: res.jars.map((j) => (closedIds.has(j.id) && !j.closed ? { ...j, closed: true, updatedAt: at } : j)),
    fellBack: !mono && jars.some((j) => j.monoId && !j.closed),
    unread,
    closedNow,
  };
}

/** Open jars nobody has read for a while: what the tab renews by itself when opened. */
export const ownJarsStale = (jars: OwnJar[], now: number, maxAge = STALE_AFTER_MS) =>
  jars.some((j) => !j.closed && (!j.syncedAt || now - j.syncedAt > maxAge));

/** The link as printed on a card: without the scheme, which only takes room. */
export const ownJarLink = (shortId: string) => jarShareLink(shortId).replace(/^https:\/\//, '');

/** Raised ÷ goal as a whole percent (rounded down, so 99.6% never claims 100), or null without a goal. */
export const goalPct = (raised: number, goal: number | undefined) => (goal && goal > 0 ? Math.floor((raised / goal) * 100) : null);

/**
 * The jar as the templates' numbers. There are no donations behind it, so every per-donation figure is
 * zero and `donationCount` 0 tells the shared footer to stay out; the dates run from the first record
 * the app has of the jar to the latest read.
 */
export function ownJarAggregates(jar: OwnJar, now: number = Date.now()): Aggregates {
  const first = new Date(jar.history?.[0]?.at ?? jar.addedAt);
  const last = new Date(jar.syncedAt ?? now);
  return {
    totalAmount: jar.raised,
    totalRaised: jar.raised,
    donationCount: 0,
    avgDonation: 0,
    medianDonation: 0,
    modeDonation: 0,
    p25Donation: 0,
    p75Donation: 0,
    minDonation: 0,
    maxDonation: 0,
    withdrawals: [],
    totalWithdrawn: 0,
    currentBalance: jar.raised,
    impliedRefunds: 0,
    byDay: new Map(),
    byHour: new Map(),
    byDate: new Map(),
    cumulative: [],
    firstDate: first,
    lastDate: last < first ? first : last,
    smallDonations: 0,
    mediumDonations: 0,
    largeDonations: 0,
    topDonors: [],
    topDonorsByCount: [],
    uniqueDonors: 0,
    anonymousDonations: 0,
  };
}
