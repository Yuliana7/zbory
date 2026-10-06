import type { RawDonation } from '../types';
import { rowTimestamp, unixToKyivWallClock } from './timestamps';

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
// Monobank's docs give the limit per function ("this function — no more than
// once per 60 seconds", for client-info and for statement separately), so each
// endpoint is paced on its own; one second of margin on top. If Monobank ever
// counts them together, the 429 it answers with is waited out and retried.
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

type Endpoint = 'client-info' | 'statement';

/** Remembers when each endpoint was last called, so a call can wait out its rate limit. */
export interface Pacer {
  lastRequestAt: Partial<Record<Endpoint, number>>;
}
export const createPacer = (): Pacer => ({ lastRequestAt: {} });
const sharedPacer = createPacer();

export interface MonobankDeps {
  fetch?: typeof fetch;
  /** Resolves after `ms`; rejects if `signal` aborts. Injectable so tests don't wait a minute. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Clock in ms; injectable together with `sleep` so tests can run on virtual time. */
  now?: () => number;
  pacer?: Pacer;
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

/**
 * Runs one API request no sooner than REQUEST_GAP_MS after the previous request
 * to the same endpoint — time the user spent between steps counts. A request
 * that Monobank didn't count (rejected token, or it never reached the server)
 * doesn't use up the window, so a typo or a dropped connection doesn't cost a
 * minute. `onWait` gets the seconds left, once per second.
 */
async function paced<T>(
  endpoint: Endpoint,
  deps: MonobankDeps,
  signal: AbortSignal | undefined,
  onWait: ((secondsLeft: number) => void) | undefined,
  send: () => Promise<T>,
): Promise<T> {
  const pacer = deps.pacer ?? sharedPacer;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;

  const remaining = () => {
    const last = pacer.lastRequestAt[endpoint];
    return last === undefined ? 0 : last + REQUEST_GAP_MS - now();
  };
  for (let left = remaining(); left > 0; left = remaining()) {
    onWait?.(Math.ceil(left / 1000));
    await sleep(Math.min(1000, left), signal);
  }

  const previous = pacer.lastRequestAt[endpoint];
  pacer.lastRequestAt[endpoint] = now();
  try {
    return await send();
  } catch (err) {
    if (err instanceof MonobankError && (err.kind === 'invalid-token' || err.kind === 'network')) {
      if (previous === undefined) delete pacer.lastRequestAt[endpoint];
      else pacer.lastRequestAt[endpoint] = previous;
    }
    throw err;
  }
}

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

interface FetchJarsOptions {
  deps?: MonobankDeps;
  signal?: AbortSignal;
  /** seconds left when the rate limit makes this request wait */
  onWait?: (secondsLeft: number) => void;
}

export async function fetchJars(token: string, { deps = {}, signal, onWait }: FetchJarsOptions = {}): Promise<MonoJar[]> {
  const info = await paced('client-info', deps, signal, onWait, () =>
    request<{ jars?: MonoJar[] }>('/personal/client-info', token.trim(), deps, signal),
  );
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
  const byId = new Map<string, MonoStatementItem>();
  let done = 0;
  let total = estimateRequests(fromSec, toSec);
  const report = (waitSeconds: number) => onProgress?.({ done, total, waitSeconds });

  let cursorTo = toSec;
  let rateLimited = 0;
  while (cursorTo > fromSec) {
    const windowFrom = Math.max(fromSec, cursorTo - MAX_WINDOW_SEC);

    let items: MonoStatementItem[];
    try {
      // Waits out the rate limit first (reporting the countdown), then sends
      items = await paced('statement', deps, signal, report, () => {
        report(0);
        return request<MonoStatementItem[]>(
          `/personal/statement/${encodeURIComponent(jarId)}/${windowFrom}/${cursorTo}`,
          token.trim(),
          deps,
          signal,
        );
      });
    } catch (err) {
      // Asked to slow down: the pacer already counts that request, so trying again waits a full window
      if (err instanceof MonobankError && err.kind === 'rate-limit' && rateLimited < RATE_LIMIT_RETRIES) {
        rateLimited += 1;
        continue;
      }
      throw err;
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
      // The API's own instant is the source of truth; the clock text is the CSV's Kyiv-time spelling of it
      ts: i.time,
      date: unixToKyivWallClock(i.time),
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

/** Unix seconds for an <input type="date"> value, at the start of that day on the user's clock. */
export const dayStartSec = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
};

/** Unix seconds for the end of that day on the user's clock, never later than `nowSec`. */
export const dayEndSec = (isoDate: string, nowSec: number) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.min(nowSec, Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000));
};

/** ISO date (YYYY-MM-DD) of a Date's own (local) calendar day. */
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Default import range: the last 30 days, ending today (the user's today). */
export function defaultRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
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
    const ts = rowTimestamp(row);
    if (ts !== null && ts > newest) newest = ts;
  }
  return Number.isFinite(newest) ? toIsoDate(new Date(newest * 1000)) : null;
}
