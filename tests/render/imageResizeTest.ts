import { BG_MAX_SIDE, fitWithin } from '../../src/utils/imageResize';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const a = fitWithin(4032, 3024, BG_MAX_SIDE);
check('12 MP landscape photo: longest side capped', a.width === 3000 && a.height === 2250, JSON.stringify(a));
const b = fitWithin(3024, 4032, BG_MAX_SIDE);
check('12 MP portrait photo: longest side capped, ratio kept', b.width === 2250 && b.height === 3000, JSON.stringify(b));
const c = fitWithin(8064, 6048, BG_MAX_SIDE);
check('48 MP photo: capped, ratio kept', c.width === 3000 && c.height === 2250, JSON.stringify(c));
check('already small: untouched', JSON.stringify(fitWithin(1080, 1920, BG_MAX_SIDE)) === '{"width":1080,"height":1920}');
check('exactly at the cap: untouched', JSON.stringify(fitWithin(3000, 1000, BG_MAX_SIDE)) === '{"width":3000,"height":1000}');
check('never upscales', fitWithin(100, 50, BG_MAX_SIDE).width === 100);
check('odd ratio stays within the cap on both sides', (() => { const r = fitWithin(10001, 3333, 3000); return r.width === 3000 && r.height <= 3000 && Math.abs(r.width / r.height - 10001 / 3333) < 0.01; })());

console.log(failures === 0 ? '\nAll image resize checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
