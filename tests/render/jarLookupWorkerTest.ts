import { handle } from '../../worker/src/index';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const env = { ALLOWED_ORIGINS: 'https://yuliana7.github.io,http://localhost:5173' };
const SITE = 'https://yuliana7.github.io';
const LONG = 'A'.repeat(32);
const req = (id: string, origin: string | null = SITE, method = 'GET') =>
  new Request(`https://worker.example/${id}`, { method, headers: origin ? { Origin: origin } : {} });
const answer = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const full = { extJarId: LONG, ownerName: 'Приватне', iban: 'UA00', mainJar: { replenishmentLink: 'MAINJAR123', ownerName: 'Приватне' } };

(async () => {
  let r = await handle(req('6PMSLXKJrf'), env, answer(full));
  const text = await r.clone().text();
  const body = await r.json();
  check('gives the long id and the main jar', r.status === 200 && body.longId === LONG && body.mainJar === 'MAINJAR123');
  check('passes on nothing else from the answer', !text.includes('Приватне') && !text.includes('UA00'));
  check('says which site may read it', r.headers.get('Access-Control-Allow-Origin') === SITE);

  r = await handle(req('63ZKbQLLG5'), env, answer({ extJarId: LONG }));
  check('a main jar has no main jar', !('mainJar' in (await r.json())));

  let called = false;
  const spy = (async () => ((called = true), new Response('{}'))) as unknown as typeof fetch;
  r = await handle(req('6PMSLXKJrf', 'https://other.example'), env, spy);
  check('another site is refused, and Monobank is not called', r.status === 403 && !called);
  r = await handle(req('6PMSLXKJrf', null), env, spy);
  check('no origin is refused', r.status === 403 && !called);
  r = await handle(req('6PMSLXKJrf', SITE, 'OPTIONS'), env, spy);
  check('preflight', r.status === 204 && !called);
  r = await handle(req('6PMSLXKJrf', SITE, 'POST'), env, spy);
  check('only GET', r.status === 405 && !called);
  r = await handle(req('not-an-id!'), env, spy);
  check('a malformed id never reaches Monobank', r.status === 400 && !called);

  r = await handle(req('AAAAAAAAAA'), env, answer({ errCode: '7014', errText: 'x' }));
  check('an unknown jar → 404 (Monobank answers 200 with an error code)', r.status === 404 && (await r.json()).error === 'not-found');
  r = await handle(req('AAAAAAAAAA'), env, answer({}, 429));
  check('throttled → 429', r.status === 429 && (await r.json()).error === 'rate-limit');
  r = await handle(req('AAAAAAAAAA'), env, answer({}, 500));
  check('Monobank failing → 502', r.status === 502);
  r = await handle(req('AAAAAAAAAA'), env, (async () => new Response('<html>')) as unknown as typeof fetch);
  check('not JSON → 502', r.status === 502);
  r = await handle(req('AAAAAAAAAA'), env, (async () => { throw new Error('down'); }) as unknown as typeof fetch);
  check('network failure → 502', r.status === 502);
  r = await handle(req('AAAAAAAAAA'), env, answer({ extJarId: '../etc' }));
  check('a strange id from upstream is not passed on', r.status === 502);

  console.log(failures === 0 ? '\nAll lookup checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
