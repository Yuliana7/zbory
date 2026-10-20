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
}

export type JarErrorKind = 'rate-limit' | 'network' | 'not-found' | 'currency' | 'unexpected';

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
