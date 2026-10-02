import type { RawDonation } from '../types';
import { parseUkrainianDate } from './csvParser';

// Monobank personal API (https://api.monobank.ua/docs). The user's token is
// passed straight through to monobank and never stored or logged by the app —
// callers keep it in component state only. The API answers browser preflights
// (access-control-allow-origin: *), so no proxy/backend is involved.

export const MONOBANK_API = 'https://api.monobank.ua';

const UAH = 980;
// The statement endpoint covers at most 31 days (+1 hour) per request.
const MAX_WINDOW_SEC = 31 * 24 * 60 * 60;
// A response holds at most 500 items; a full page means there may be more.
const PAGE_LIMIT = 500;
// Both endpoints allow one request per 60 seconds.
const REQUEST_GAP_MS = 61_000;
const RATE_LIMIT_RETRIES = 3;

const WITHDRAWAL_CATEGORY = 'Часткове зняття';
const DONATION_CATEGORY = 'За посиланням';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A jar as returned by client-info. Money is in kopecks. */
export interface MonoJar {
  id: string;
  sendId: string;
  title: string;
  description: string;
  currencyCode: number;
  balance: number;
  goal: number;
}

export interface MonoStatementItem {
  id: string;
  time: number; // unix seconds
  description: string;
  comment?: string;
  amount: number; // kopecks, negative = money leaving the jar
  balance: number; // kopecks, jar balance after this operation
  hold?: boolean;
}

export type MonobankErrorKind = 'invalid-token' | 'rate-limit' | 'network' | 'unexpected';

export class MonobankError extends Error {
  constructor(public kind: MonobankErrorKind) {
    super(kind);
    this.name = 'MonobankError';
  }
}

export interface MonobankDeps {
  fetch?: typeof fetch;
  /** Resolves after `ms`; rejects if `signal` aborts. Injectable so tests don't wait a minute. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface FetchProgress {
  /** statement requests finished so far */
  done: number;
  /** estimated total requests (grows if a window turns out to be paginated) */
  total: number;
  /** seconds left until the next request is allowed (0 = requesting now) */
  waitSeconds: number;
}

// ─── Plumbing ─────────────────────────────────────────────────────────────────

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

async function request<T>(path: string, token: string, deps: MonobankDeps, signal?: AbortSignal): Promise<T> {
  const doFetch = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${MONOBANK_API}${path}`, { headers: { 'X-Token': token }, signal });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new MonobankError('network');
  }
  if (res.status === 403) throw new MonobankError('invalid-token');
  if (res.status === 429) throw new MonobankError('rate-limit');
  if (!res.ok) throw new MonobankError('unexpected');
  try {
    return (await res.json()) as T;
  } catch {
    throw new MonobankError('unexpected');
  }
}

// ─── client-info ──────────────────────────────────────────────────────────────

export async function fetchJars(token: string, deps: MonobankDeps = {}, signal?: AbortSignal): Promise<MonoJar[]> {
  const info = await request<{ jars?: MonoJar[] }>('/personal/client-info', token.trim(), deps, signal);
  return info.jars ?? [];
}

/** Jar goal in hryvnias, if the jar has one. */
export const jarGoal = (jar: MonoJar): number | undefined => (jar.goal > 0 ? jar.goal / 100 : undefined);

/** The app works in hryvnias only — jars in other currencies can't be imported. */
export const isUahJar = (jar: MonoJar) => jar.currencyCode === UAH;

// ─── statement ────────────────────────────────────────────────────────────────

/** Minimum number of requests a range needs (more if a window is paginated). */
export const estimateRequests = (fromSec: number, toSec: number) =>
  Math.max(1, Math.ceil((toSec - fromSec) / MAX_WINDOW_SEC));

interface FetchStatementOptions {
  token: string;
  /** a jar id (works like an account id for the statement endpoint) */
  jarId: string;
  fromSec: number;
  toSec: number;
  onProgress?: (p: FetchProgress) => void;
  signal?: AbortSignal;
  deps?: MonobankDeps;
}

/**
 * Fetches every statement item of a jar in [fromSec, toSec], newest first.
 * Walks backwards in ≤31-day windows, pages inside a window when a response is
 * full, and spaces requests to respect the 1-per-minute limit (a 429 is waited
 * out and retried).
 */
export async function fetchJarStatement({
  token,
  jarId,
  fromSec,
  toSec,
  onProgress,
  signal,
  deps = {},
}: FetchStatementOptions): Promise<MonoStatementItem[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const byId = new Map<string, MonoStatementItem>();
  let done = 0;
  let total = estimateRequests(fromSec, toSec);
  const report = (waitSeconds: number) => onProgress?.({ done, total, waitSeconds });

  // Counts down second by second so the UI can show "next request in 42 s"
  const wait = async (ms: number) => {
    for (let left = Math.ceil(ms / 1000); left > 0; left--) {
      report(left);
      await sleep(1000, signal);
    }
  };

  let cursorTo = toSec;
  while (cursorTo > fromSec) {
    const windowFrom = Math.max(fromSec, cursorTo - MAX_WINDOW_SEC);
    if (done > 0) await wait(REQUEST_GAP_MS);
    report(0);

    let items: MonoStatementItem[] | null = null;
    for (let attempt = 0; items === null; attempt++) {
      try {
        items = await request<MonoStatementItem[]>(
          `/personal/statement/${encodeURIComponent(jarId)}/${windowFrom}/${cursorTo}`,
          token.trim(),
          deps,
          signal,
        );
      } catch (err) {
        if (err instanceof MonobankError && err.kind === 'rate-limit' && attempt < RATE_LIMIT_RETRIES) {
          await wait(REQUEST_GAP_MS);
          continue;
        }
        throw err;
      }
    }
    done += 1;
    for (const item of items) byId.set(item.id, item);

    if (items.length >= PAGE_LIMIT) {
      // Truncated: continue from the oldest item we got. The boundary second is
      // fetched again and de-duplicated by id.
      const oldest = Math.min(...items.map((i) => i.time));
      cursorTo = oldest >= cursorTo ? cursorTo - 1 : oldest;
      total = Math.max(total, done + estimateRequests(fromSec, cursorTo));
    } else {
      cursorTo = windowFrom;
    }
  }

  report(0);
  return [...byId.values()].sort((a, b) => b.time - a.time);
}

// ─── Mapping to the app's data model ──────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
const toRowDate = (unixSec: number) => {
  const d = new Date(unixSec * 1000);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const kopecks = (n: number) => (n / 100).toFixed(2);

/**
 * Statement items → the rows a Monobank CSV would contain, so everything
 * downstream (manual-entry review, normalization, merging) is unchanged.
 * Money leaving the jar becomes a "Часткове зняття" row; pending (hold) items
 * and zero amounts are skipped. Newest first, like the CSV.
 */
export function statementItemsToRawDonations(items: MonoStatementItem[]): RawDonation[] {
  return items
    .filter((i) => !i.hold && i.amount !== 0)
    .sort((a, b) => b.time - a.time)
    .map((i) => ({
      date: toRowDate(i.time),
      category: i.amount < 0 ? WITHDRAWAL_CATEGORY : DONATION_CATEGORY,
      amount: kopecks(Math.abs(i.amount)),
      currency: 'UAH',
      additionalInfo: i.description ?? '',
      comment: i.comment ?? '',
      balance: kopecks(i.balance),
      balanceCurrency: 'UAH',
    }));
}

// ─── Date ranges ──────────────────────────────────────────────────────────────

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Unix seconds for an <input type="date"> value, at the start of that local day. */
export const dayStartSec = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
};

/** Unix seconds for the end of that local day, never later than `nowSec`. */
export const dayEndSec = (isoDate: string, nowSec: number) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.min(nowSec, Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000));
};

/** ISO date (YYYY-MM-DD) in local time. */
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Default import range: the last 30 days, ending today. */
export function defaultRange(now = new Date()): { from: string; to: string } {
  const from = new Date(startOfDay(now));
  from.setDate(from.getDate() - 30);
  return { from: toIsoDate(from), to: toIsoDate(now) };
}

/**
 * Where an "update this campaign" fetch should start: the start of the day of
 * the newest saved row, so the same day is re-fetched (and de-duplicated on
 * merge) instead of risking a gap.
 */
export function updateRangeStart(rawData: RawDonation[]): string | null {
  let newest = -Infinity;
  for (const row of rawData) {
    const t = parseUkrainianDate(row.date)?.getTime();
    if (t !== undefined && !Number.isNaN(t) && t > newest) newest = t;
  }
  return Number.isFinite(newest) ? toIsoDate(new Date(newest)) : null;
}
