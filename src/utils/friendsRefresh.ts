import type { FriendJar } from '../types';
import { applyJarInfo, friendsToRows, rowsToFriends } from './friendJars';
import { JarError, fetchPublicJar, type JarErrorKind } from './monobankJar';

/** A linked jar read less than this long ago is not read again by the automatic refresh. */
export const STALE_AFTER_MS = 15 * 60 * 1000;
/** Pause between two reads — the endpoint is throttled. */
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

export interface RefreshOptions {
  /** which helpers to read — by default every linked open one */
  only?: (f: FriendJar) => boolean;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  gapMs?: number;
  signal?: AbortSignal;
  /** called before each read (`current` is the helper being read) and after the last one */
  onProgress?: (p: { done: number; total: number; current?: string }) => void;
}

export interface RefreshResult {
  friends: FriendJar[];
  updated: number;
  failed: number;
  /** stopped early on "too many requests" */
  rateLimited: boolean;
  firstError?: JarErrorKind;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads the linked open jars one after another and returns the helpers with their new amounts and status.
 * Whatever the user typed stays (see applyJarInfo); `updatedAt` moves only for helpers that really changed.
 * Stops at the first 429 or when `signal` aborts — what was read until then is kept.
 */
export async function refreshSavedFriends(friends: FriendJar[], opts: RefreshOptions = {}): Promise<RefreshResult> {
  const { only = () => true, sleep = realSleep, now = Date.now, gapMs = REFRESH_GAP_MS, signal, onProgress } = opts;
  const todo = linkedOpen(friends).filter(only);
  let rows = friendsToRows(friends);
  const result: Omit<RefreshResult, 'friends'> = { updated: 0, failed: 0, rateLimited: false };

  for (let i = 0; i < todo.length; i++) {
    if (signal?.aborted) break;
    if (i > 0) await sleep(gapMs);
    if (signal?.aborted) break;
    const f = todo[i];
    onProgress?.({ done: i, total: todo.length, current: f.id });
    try {
      const jar = await fetchPublicJar(f.jarId!, { fetch: opts.fetch, signal });
      rows = rows.map((r) => (r.id === f.id ? applyJarInfo(r, jar, now()) : r));
      result.updated++;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') break;
      result.failed++;
      result.firstError ??= err instanceof JarError ? err.kind : 'unexpected';
      if (err instanceof JarError && err.kind === 'rate-limit') {
        result.rateLimited = true;
        break;
      }
    }
  }
  onProgress?.({ done: todo.length, total: todo.length });
  return { friends: rowsToFriends(rows, friends, now()), ...result };
}
