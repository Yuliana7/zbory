import { JarError, fetchPublicJar, mapPublicJar, parseJarId } from '../../src/utils/monobankJar';

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
  console.log(failures === 0 ? '\nAll jar checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
