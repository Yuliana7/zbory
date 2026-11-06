import { useLayoutEffect, useState } from 'react';
import type { CardState } from '../../types';
import type { RemovableElement } from '../../utils/templateConfig';

const BORDER_WIDTH = 2;
/** smaller on screen than this, an element still gets a tap area of this height */
const MIN_TAP_HEIGHT = 36;
/** with no visible height at all (the glow), there's nothing to tap: it is picked from a list under the card */
const NO_HEIGHT = 4;

interface Box {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ElementsOverlayProps {
  templateRef: React.RefObject<HTMLDivElement>;
  elements: RemovableElement[];
  card: CardState;
  effectiveScale: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** which elements are too thin to tap on the card */
  onThinChange: (ids: string[]) => void;
}

/**
 * An outline over each visible element, tapped to select it. Measured live from the rendered DOM
 * (data-element attributes) rather than assumed positions, because templates reflow when the format, the
 * text or a size changes. Rendered as a sibling of the exported card node, so it never appears in the PNG.
 */
export function ElementsOverlay({ templateRef, elements, card, effectiveScale, selectedId, onSelect, onThinChange }: ElementsOverlayProps) {
  const [boxes, setBoxes] = useState<Box[]>([]);

  // No dependency array: it re-measures after every render while the overlay is mounted, so any reflow
  // is caught. The equality check settles it instead of looping.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately unbounded, see above
  useLayoutEffect(() => {
    const root = templateRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const next: Box[] = [];
    for (const el of elements) {
      if (card.hiddenElements.includes(el.id)) continue;
      const node = root.querySelector<HTMLElement>(`[data-element="${el.id}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      next.push({
        id: el.id,
        left: (r.left - rootRect.left) / effectiveScale,
        top: (r.top - rootRect.top) / effectiveScale,
        width: r.width / effectiveScale,
        height: r.height / effectiveScale,
      });
    }
    setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    const thin = next.filter((b) => b.height * effectiveScale < NO_HEIGHT).map((b) => b.id);
    onThinChange(thin);
  });

  const border = BORDER_WIDTH / effectiveScale;
  // the smaller an element, the higher it sits, so one inside another can still be reached
  const tappable = boxes.filter((b) => b.height * effectiveScale >= NO_HEIGHT).sort((a, b) => b.width * b.height - a.width * a.height);
  const minHeight = MIN_TAP_HEIGHT / effectiveScale;

  return (
    <>
      {tappable.map((b) => {
        const selected = b.id === selectedId;
        return (
          <button
            key={b.id}
            data-overlay-element={b.id}
            aria-pressed={selected}
            aria-label={elements.find((e) => e.id === b.id)?.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(b.id);
            }}
            style={{
              position: 'absolute',
              left: b.left,
              top: b.top + Math.min(0, (b.height - minHeight) / 2),
              width: b.width,
              height: Math.max(b.height, minHeight),
              border: `${border}px ${selected ? 'solid rgba(129,140,248,1)' : 'dashed rgba(165,180,252,0.55)'}`,
              borderRadius: 10,
              background: selected ? 'rgba(99,102,241,0.14)' : 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        );
      })}
    </>
  );
}
