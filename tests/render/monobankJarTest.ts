import { JAR_LOOKUP_URL, JarError, fetchPublicJar, lookupJar, mapPublicJar, parseJarId, parseJarRef } from '../../src/utils/monobankJar';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const ID = '3xpbdqzsr7At11TZ9UPtsXneijoi61K2';

// ── parsing what the user pastes ──
check('id: plain', parseJarId(ID) === ID);
check('id: surrounded by spaces/newlines', parseJarId(`  ${ID}\n`) === ID);
check('id: the full API link', parseJarId(`https://api.monobank.ua/bank/jar/${ID}`) === ID);
check('id: link with a query string', parseJarId(`https://api.monobank.ua/bank/jar/${ID}?x=1`) === ID);
check('id: too short / garbage / empty → null', parseJarId('abc') === null && parseJarId('не id банки') === null && parseJarId('') === null);

// ── what was pasted ──
const SHORT = 'AbCdEf1234';
check('ref: a share link is a short id', JSON.stringify(parseJarRef(`https://send.monobank.ua/jar/${SHORT}`)) === JSON.stringify({ kind: 'short', id: SHORT }));
check('ref: share link with a query and a slash', parseJarRef(`send.monobank.ua/jar/${SHORT}/?a=1`)?.id === SHORT);
check('ref: a bare short id', parseJarRef(SHORT)?.kind === 'short');
check('ref: a long id stays long', parseJarRef(ID)?.kind === 'long' && parseJarRef(`https://api.monobank.ua/bank/jar/${ID}`)?.id === ID);
check('ref: garbage → null', parseJarRef('не посилання') === null && parseJarRef('') === null);

// ── mapping the response ──
const body = { amount: 50000, goal: 1000000, title: 'Akatsuki Team', ownerName: 'Наталія Б.', currency: 980, closed: false, jarId: '4q7xM4p43t' };
const jar = mapPublicJar(body);
check('map: kopecks → UAH', jar.raised === 500 && jar.goal === 10000);
check('map: title, owner, open', jar.title === 'Akatsuki Team' && jar.ownerName === 'Наталія Б.' && jar.closed === false);
check('map: closed flag', mapPublicJar({ ...body, closed: true }).closed === true);
check('map: no goal → undefined', mapPublicJar({ ...body, goal: 0 }).goal === undefined);
const throwsKind = (fn: () => unknown, kind: string) => {
  try {
    fn();
  } catch (e) {
    return e instanceof JarError && e.kind === kind;
  }
  return false;
};
check('map: non-hryvnia jar → currency error', throwsKind(() => mapPublicJar({ ...body, currency: 978 }), 'currency'));
check('map: nonsense body → unexpected', throwsKind(() => mapPublicJar({ hello: 1 }), 'unexpected'));

// ── the request, with a faked fetch ──
const respond = (status: number, json: unknown = {}) => (async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;
const kindOf = async (status: number, json?: unknown) => {
  try {
    await fetchPublicJar(ID, { fetch: respond(status, json) });
  } catch (e) {
    return e instanceof JarError ? e.kind : 'other';
  }
  return 'ok';
};
let url = '';
const spy = (async (u: string) => {
  url = u;
  return new Response(JSON.stringify(body), { status: 200 });
}) as unknown as typeof fetch;

(async () => {
  const got = await fetchPublicJar(ID, { fetch: spy });
  check('fetch: calls the public jar endpoint with the long id', url === `https://api.monobank.ua/bank/jar/${ID}` && got.raised === 500);
  check('fetch: 429 → rate-limit', (await kindOf(429)) === 'rate-limit');
  check('fetch: 400 (invalid alias) → not-found', (await kindOf(400, { errCode: 'DEFAULT_ERROR' })) === 'not-found');
  check('fetch: 404 → not-found', (await kindOf(404)) === 'not-found');
  check('fetch: 500 → unexpected', (await kindOf(500)) === 'unexpected');
  check('fetch: network failure → network', await fetchPublicJar(ID, { fetch: (async () => { throw new TypeError('x'); }) as unknown as typeof fetch }).then(() => false, (e) => e instanceof JarError && e.kind === 'network'));

  check('jar: carries its short id', mapPublicJar({ amount: 100, jarId: 'ShortId123' }).shortId === 'ShortId123' && mapPublicJar({ amount: 100 }).shortId === undefined);

  // ── looking a share link up ──
  let asked = '';
  const found = await lookupJar(SHORT, { fetch: (async (u: string) => ((asked = u), new Response(JSON.stringify({ longId: ID, mainJar: 'MainJarId01' })))) as unknown as typeof fetch });
  check('lookup: asks our worker, gives the long id and the main jar', asked === `${JAR_LOOKUP_URL}/${SHORT}` && found.longId === ID && found.mainJar === 'MainJarId01');
  const failsWith = (fetcher: typeof fetch) => lookupJar(SHORT, { fetch: fetcher }).then(() => null, (e) => (e instanceof JarError ? e.kind : 'other'));
  check('lookup: unknown jar → not-found', (await failsWith(respond(404))) === 'not-found');
  check('lookup: throttled → rate-limit', (await failsWith(respond(429))) === 'rate-limit');
  check('lookup: worker down → lookup', (await failsWith(respond(502))) === 'lookup' && (await failsWith((async () => { throw new TypeError('x'); }) as unknown as typeof fetch)) === 'lookup');
  check('lookup: a strange answer → lookup', (await failsWith(respond(200, {}))) === 'lookup');

  console.log(failures === 0 ? '\nAll jar checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
