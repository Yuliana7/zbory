import { undoLastHidden } from '../../src/utils/overlayLayout';
import { snapScale, withElementScale } from '../../src/utils/elementScale';
import { rem } from '../../src/utils/units';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

// ── undo in the elements editor ──
const removable = [{ id: 'header' }, { id: 'chart' }, { id: 'flag', storyOnly: true }];
check('undo: takes back the latest removal', undoLastHidden(['header', 'chart'], removable, 'story').join() === 'header');
check('undo: skips what this format cannot show', undoLastHidden(['chart', 'flag'], removable, 'post').join() === 'flag');
const none = ['flag'];
check('undo: nothing to take back returns the same list', undoLastHidden(none, removable, 'post') === none);

// ── element text size ──
check('scale: sticks to 100%', snapScale(1.02) === 1 && snapScale(0.98) === 1 && snapScale(1.03) === 1.03 && snapScale(0.5) === 0.5);
check('scale: stored per element', JSON.stringify(withElementScale(undefined, 'title', 1.5)) === '{"title":1.5}');
check('scale: others stay', JSON.stringify(withElementScale({ title: 1.5 }, 'footer', 0.8)) === '{"title":1.5,"footer":0.8}');
check('scale: 100% is not stored', JSON.stringify(withElementScale({ title: 1.5, footer: 0.8 }, 'title', 1)) === '{"footer":0.8}');
check('text sizes read the element scale', rem(32) === 'calc(2rem * var(--el-scale, 1))');

console.log(failures === 0 ? '\nAll overlay layout checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
