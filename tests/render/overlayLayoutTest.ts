import { placeButtons, type MeasuredBox } from '../../src/utils/overlayLayout';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const SIZE = 100;
const GAP = 10;
const STEP = SIZE + GAP;
const center = (b: { left: number; top: number; btnX: number; btnY: number }) => ({ x: b.left + b.btnX, y: b.top + b.btnY });
const minPairDistance = (placed: ReturnType<typeof placeButtons>) => {
  let min = Infinity;
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = center(placed[i]);
      const b = center(placed[j]);
      min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
    }
  return min;
};
const inside = (b: ReturnType<typeof placeButtons>[number]) => {
  const c = center(b);
  return c.x >= b.left && c.x <= b.left + b.width;
};

// ── well-spaced elements keep their centered button ──
let boxes: MeasuredBox[] = [
  { id: 'hero', left: 0, top: 500, width: 800, height: 300 },
  { id: 'footer', left: 0, top: 1500, width: 800, height: 100 },
];
let placed = placeButtons(boxes, SIZE, GAP);
check('spaced: buttons stay centered', placed.every((b) => center(b).x === b.left + b.width / 2 && center(b).y === b.top + b.height / 2));

// ── the real case: a 3px glow strip right above a 16px header strip ──
boxes = [
  { id: 'glow', left: 100, top: 90, width: 800, height: 3 },
  { id: 'header', left: 100, top: 100, width: 800, height: 16 },
  { id: 'hero', left: 100, top: 600, width: 800, height: 300 },
];
placed = placeButtons(boxes, SIZE, GAP);
check('glow+header: no two buttons closer than a button plus gap', minPairDistance(placed) >= STEP - 1e-9, `min ${minPairDistance(placed)}`);
check('glow+header: both buttons stay on their own outline', placed.every(inside));
check('glow+header: the taller element (header) keeps the centered spot', center(placed.find((b) => b.id === 'header')!).x === 500);

// ── order of the input must not matter for the result ──
const reversed = placeButtons([...boxes].reverse(), SIZE, GAP);
check('order-independent', JSON.stringify(placed.map((b) => [b.id, b.btnX, b.btnY]).sort()) === JSON.stringify(reversed.map((b) => [b.id, b.btnX, b.btnY]).sort()));

// ── many stacked thin elements ──
boxes = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, left: 0, top: 50 + i * 4, width: 900, height: 5 }));
placed = placeButtons(boxes, SIZE, GAP);
check('five stacked strips: all separated', minPairDistance(placed) >= STEP - 1e-9, `min ${minPairDistance(placed)}`);
check('five stacked strips: all within their outline horizontally', placed.every(inside));

// ── element narrower than a button: moves vertically instead of leaving its outline sideways ──
boxes = [
  { id: 'big', left: 0, top: 0, width: 400, height: 400 },
  { id: 'tiny', left: 190, top: 195, width: 20, height: 10 },
];
placed = placeButtons(boxes, SIZE, GAP);
check('tiny box: still ends up separated', minPairDistance(placed) >= STEP - 1e-9, `min ${minPairDistance(placed)}`);

// ── nothing to place ──
check('empty input', placeButtons([], SIZE, GAP).length === 0);
check('single element stays centered', (() => { const [b] = placeButtons([{ id: 'x', left: 10, top: 10, width: 50, height: 50 }], SIZE, GAP); return center(b).x === 35 && center(b).y === 35; })());

console.log(failures === 0 ? '\nAll overlay layout checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
