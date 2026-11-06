// Turns a Monobank jar's short id (the one in its send.monobank.ua link) into its long id.
//
// The call below has no CORS headers, so a browser app can't make it; that is the only reason this
// exists. It is stateless: nothing is stored or logged, and no token ever comes through here. It uses
// a community-documented, unofficial endpoint, so the app must keep working when this fails.

const HANDLER = 'https://send.monobank.ua/api/handler';
const SHORT_ID = /^[A-Za-z0-9]{6,20}$/;
const LONG_ID = /^[A-Za-z0-9_-]{12,64}$/;

interface Env {
  /** comma separated, e.g. "https://yuliana7.github.io,http://localhost:5173" */
  ALLOWED_ORIGINS: string;
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    },
  });
}

export async function handle(request: Request, env: Env, doFetch: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  // Stops other sites' browsers from using this; anything outside a browser can fake the header.
  if (!env.ALLOWED_ORIGINS.split(',').includes(origin)) return new Response('Forbidden', { status: 403 });
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET', Vary: 'Origin' } });
  }
  if (request.method !== 'GET') return json({ error: 'method' }, 405, origin);

  const shortId = new URL(request.url).pathname.split('/').pop() ?? '';
  if (!SHORT_ID.test(shortId)) return json({ error: 'invalid' }, 400, origin);

  let upstream: Response;
  try {
    upstream = await doFetch(HANDLER, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ c: 'hello', clientId: shortId, Pc: 'random' }),
    });
  } catch {
    return json({ error: 'upstream' }, 502, origin);
  }
  if (upstream.status === 429) return json({ error: 'rate-limit' }, 429, origin);
  if (!upstream.ok) return json({ error: 'upstream' }, 502, origin);

  let body: { extJarId?: unknown; errCode?: unknown; mainJar?: { replenishmentLink?: unknown } };
  try {
    body = await upstream.json();
  } catch {
    return json({ error: 'upstream' }, 502, origin);
  }
  // An unknown id still answers 200, with an error code instead of the jar
  if (typeof body.extJarId !== 'string' || !LONG_ID.test(body.extJarId)) {
    return json({ error: body.errCode ? 'not-found' : 'upstream' }, body.errCode ? 404 : 502, origin);
  }
  // Only what the app needs: the rest of the answer holds the owner's details and card data.
  const mainJar = body.mainJar?.replenishmentLink;
  return json({ longId: body.extJarId, ...(typeof mainJar === 'string' ? { mainJar } : null) }, 200, origin);
}

export default { fetch: (request: Request, env: Env) => handle(request, env) };
