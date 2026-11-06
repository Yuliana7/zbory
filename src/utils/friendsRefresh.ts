import type { FriendJar } from '../types';
import { applyJarInfo, friendsToRows, rowsToFriends } from './friendJars';
import { JarError, fetchPublicJar, type JarErrorKind, type PublicJar } from './monobankJar';

/** A linked jar read less than this long ago is not read again by the automatic refresh. */
export const STALE_AFTER_MS = 15 * 60 * 1000;
/** Pause before throttled jars are read again, and between those second reads. */
export const RETRY_PAUSE_MS = 3000;
export const REFRESH_GAP_MS = 1000;

/** Jars that can still change: linked to a long id and not closed. */
export const linkedOpen = (friends: FriendJar[]) => friends.filter((f) => f.jarId && !f.closed);

/** Linked open jars nobody has read for a while (or ever). */
export const staleFriends = (friends: FriendJar[], now: number, maxAge = STALE_AFTER_MS) =>
  linkedOpen(friends).filter((f) => !f.syncedAt || now - f.syncedAt > maxAge);

/** "сьогодні 14:32" for today, "20.10 14:32" otherwise — on the user's own clock. */
export function formatWhen(ms: number, now: number = Date.now()): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === new Date(now).toDateString() ? `сьогодні ${time}` : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${time}`;
}

/** When the data of the linked open jars is from: the oldest read among them; undefined if there are
 * none, or one has never been read. */
export function dataAsOf(friends: FriendJar[]): number | undefined {
  const open = linkedOpen(friends);
  if (open.length === 0 || open.some((f) => !f.syncedAt)) return undefined;
  return Math.min(...open.map((f) => f.syncedAt!));
}

export interface ReadOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** how long to let Monobank cool down before jars it throttled are tried again */
  retryPauseMs?: number;
  signal?: AbortSignal;
  /** after each jar is settled */
  onSettled?: (id: string, jar: PublicJar | null, error: JarErrorKind | null) => void;
}

export interface ReadResult {
  read: Map<string, PublicJar>;
  failed: Map<string, JarErrorKind>;
  /** Monobank still says "too many requests" after the retry */
  rateLimited: boolean;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads the given jars all at once. The endpoint throttles per IP, so a burst can get 429s: whatever
 * came back is kept, and the throttled jars get one more try after a pause, one at a time, stopping
 * if Monobank is still saying no.
 */
export async function readJars(jars: Array<{ id: string; jarId: string }>, opts: ReadOptions = {}): Promise<ReadResult> {
  const { sleep = realSleep, retryPauseMs = RETRY_PAUSE_MS, signal, onSettled } = opts;
  const result: ReadResult = { read: new Map(), failed: new Map(), rateLimited: false };

  const readOne = async (id: string, jarId: string) => {
    try {
      const jar = await fetchPublicJar(jarId, { fetch: opts.fetch, signal });
      result.read.set(id, jar);
      result.failed.delete(id);
      onSettled?.(id, jar, null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const kind = err instanceof JarError ? err.kind : 'unexpected';
      result.failed.set(id, kind);
      onSettled?.(id, null, kind);
    }
  };

  await Promise.all(jars.map((j) => readOne(j.id, j.jarId)));

  const throttled = jars.filter((j) => result.failed.get(j.id) === 'rate-limit');
  if (throttled.length > 0 && !signal?.aborted) {
    await sleep(retryPauseMs);
    for (const j of throttled) {
      if (signal?.aborted) break;
      await readOne(j.id, j.jarId);
      if (result.failed.get(j.id) === 'rate-limit') break;
      await sleep(REFRESH_GAP_MS);
    }
  }
  result.rateLimited = [...result.failed.values()].includes('rate-limit');
  return result;
}

export interface RefreshOptions extends Omit<ReadOptions, 'onSettled'> {
  /** which helpers to read — by default every linked open one */
  only?: (f: FriendJar) => boolean;
  now?: () => number;
  onProgress?: (p: { done: number; total: number }) => void;
}

export interface RefreshResult {
  friends: FriendJar[];
  updated: number;
  failed: number;
  /** some jars were left unread on "too many requests" */
  rateLimited: boolean;
  firstError?: JarErrorKind;
}

/** Reads the linked open jars and returns the helpers with their new amounts and status. Whatever the
 * user typed stays (see applyJarInfo); `updatedAt` moves only for helpers that really changed. */
export async function refreshSavedFriends(friends: FriendJar[], opts: RefreshOptions = {}): Promise<RefreshResult> {
  const { only = () => true, now = Date.now, onProgress, ...read } = opts;
  const todo = linkedOpen(friends).filter(only);
  let done = 0;
  onProgress?.({ done, total: todo.length });
  const res = await readJars(
    todo.map((f) => ({ id: f.id, jarId: f.jarId! })),
    { ...read, onSettled: () => onProgress?.({ done: ++done, total: todo.length }) },
  );
  const at = now();
  const rows = friendsToRows(friends).map((r) => {
    const jar = res.read.get(r.id);
    return jar ? applyJarInfo(r, jar, at) : r;
  });
  return {
    friends: rowsToFriends(rows, friends, at),
    updated: res.read.size,
    failed: res.failed.size,
    rateLimited: res.rateLimited,
    firstError: [...res.failed.values()][0],
  };
}
