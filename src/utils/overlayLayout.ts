/** Box of one removable element, measured from the rendered card (native 1080-wide units). */
export interface MeasuredBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ElementBox extends MeasuredBox {
  /** where the remove button sits, relative to the box's top-left (same units) */
  btnX: number;
  btnY: number;
}

/**
 * Chooses a spot for every remove button so no two overlap. Thin elements (the
 * header, the glow's near-zero-height wrapper, the flag bar) sit right next to
 * each other, and centering each button in its own outline stacked them on top
 * of one another — the wrong one got hit. Elements with the most height keep
 * their centered button; the others shift sideways along their own (wide)
 * outline first, then up/down, to the nearest spot that is free.
 */
export function placeButtons(boxes: MeasuredBox[], size: number, gap: number): ElementBox[] {
  const step = size + gap;
  const placed: Array<{ x: number; y: number }> = [];
  const spots = new Map<string, { x: number; y: number }>();
  const free = (x: number, y: number) => placed.every((p) => Math.hypot(p.x - x, p.y - y) >= step);

  for (const b of [...boxes].sort((a, c) => c.height - a.height)) {
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    let spot = { x: cx, y: cy };
    if (!free(cx, cy)) {
      const minX = b.left + size / 2;
      const maxX = b.left + b.width - size / 2;
      let found: { x: number; y: number } | null = null;
      for (let k = 1; k <= 12 && !found; k++) {
        for (const x of [cx + k * step, cx - k * step]) {
          if (x >= minX && x <= maxX && free(x, cy)) {
            found = { x, y: cy };
            break;
          }
        }
      }
      for (let k = 1; k <= 12 && !found; k++) {
        for (const y of [cy + k * step, cy - k * step]) {
          if (free(cx, y)) {
            found = { x: cx, y };
            break;
          }
        }
      }
      if (found) spot = found;
    }
    placed.push(spot);
    spots.set(b.id, spot);
  }

  return boxes.map((b) => {
    const spot = spots.get(b.id)!;
    return { ...b, btnX: spot.x - b.left, btnY: spot.y - b.top };
  });
}

