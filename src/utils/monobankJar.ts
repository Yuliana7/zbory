// A helper's own jar, read through its "long id" — the one unofficial call the app makes.
//
//   GET https://api.monobank.ua/bank/jar/{longJarId}   (no token; answers browsers with CORS *)
//
// It is community-documented, not part of Monobank's official API, and throttles hard (HTTP 429), so the
// app only calls it when the user asks for it (add by id, «Оновити») and always keeps manual entry as the
// fallback. Nothing is stored except what the user sees in the helper row.

import { MONOBANK_API } from './monobankApi';

export interface PublicJar {
  title: string;
  ownerName: string;
  /** collected so far, UAH */
  raised: number;
  /** the jar's own goal, UAH; undefined when it has none */
  goal?: number;
  /** the jar was closed by its owner — nothing more will come in */
  closed: boolean;
  /** the id in the jar's share link */
  shortId?: string;
}

export type JarErrorKind = 'rate-limit' | 'network' | 'not-found' | 'currency' | 'unexpected' | 'lookup';

export class JarError extends Error {
  constructor(public kind: JarErrorKind) {
    super(kind);
    this.name = 'JarError';
  }
}

/** What a pasted long id (or the full API link containing it) boils down to; null if it can't be one. */
export function parseJarId(input: string): string | null {
  const last = input.trim().split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  return /^[A-Za-z0-9_-]{12,64}$/.test(last) ? last : null;
}

const SHORT_ID = /^[A-Za-z0-9]{6,20}$/;
/** a long id is about 32 characters; the id in a share link is about 10 */
const LONGEST_SHORT_ID = 20;

/** What a pasted text points at: a long id, or the short id of a share link, which has to be looked up. */
export function parseJarRef(input: string): { kind: 'long' | 'short'; id: string } | null {
  const text = input.trim();
  const last = text.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  const isShareLink = /send\.monobank\.ua/i.test(text);
  if (SHORT_ID.test(last) && (isShareLink || last.length <= LONGEST_SHORT_ID)) return { kind: 'short', id: last };
  const long = parseJarId(text);
  return long ? { kind: 'long', id: long } : null;
}

/** Our small worker (see worker/): the one thing a browser can't do itself is turn a share link into a long id. */
export const JAR_LOOKUP_URL = 'https://zbory-jar-lookup.zbory.workers.dev';

export interface JarLookup {
  longId: string;
  /** the short id of the main jar this one feeds; a main jar has none */
  mainJar?: string;
}

export async function lookupJar(shortId: string, { fetch: doFetch = fetch, signal }: FetchJarOptions = {}): Promise<JarLookup> {
  let res: Response;
  try {
    res = await doFetch(`${JAR_LOOKUP_URL}/${encodeURIComponent(shortId)}`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new JarError('lookup');
  }
  if (res.status === 429) throw new JarError('rate-limit');
  if (res.status === 400 || res.status === 404) throw new JarError('not-found');
  if (!res.ok) throw new JarError('lookup');
  try {
    const body = (await res.json()) as Partial<JarLookup>;
    if (typeof body.longId !== 'string') throw new Error();
    return { longId: body.longId, mainJar: typeof body.mainJar === 'string' ? body.mainJar : undefined };
  } catch {
    throw new JarError('lookup');
  }
}

const UAH_CODE = 980;
const kopecksToUah = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n / 100 : 0);

/** The response, reduced to what the app uses. */
export function mapPublicJar(body: unknown): PublicJar {
  const j = (body ?? {}) as Record<string, unknown>;
  if (typeof j.amount !== 'number') throw new JarError('unexpected');
  if (j.currency !== undefined && Number(j.currency) !== UAH_CODE) throw new JarError('currency');
  const goal = kopecksToUah(j.goal);
  return {
    title: typeof j.title === 'string' ? j.title : '',
    ownerName: typeof j.ownerName === 'string' ? j.ownerName : '',
    raised: kopecksToUah(j.amount),
    goal: goal > 0 ? goal : undefined,
    closed: j.closed === true,
    shortId: typeof j.jarId === 'string' ? j.jarId : undefined,
  };
}

export interface FetchJarOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export async function fetchPublicJar(longId: string, { fetch: doFetch = fetch, signal }: FetchJarOptions = {}): Promise<PublicJar> {
  let res: Response;
  try {
    res = await doFetch(`${MONOBANK_API}/bank/jar/${encodeURIComponent(longId)}`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new JarError('network');
  }
  if (res.status === 429) throw new JarError('rate-limit');
  if (res.status === 400 || res.status === 404) throw new JarError('not-found');
  if (!res.ok) throw new JarError('unexpected');
  try {
    return mapPublicJar(await res.json());
  } catch (err) {
    throw err instanceof JarError ? err : new JarError('unexpected');
  }
}
