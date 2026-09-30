import { useLayoutEffect, useState } from 'react';
import type { CardState } from '../../types';
import type { RemovableElement } from '../../utils/templateConfig';
import { XIcon } from '../../icons';

interface ElementBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

// Constant on-screen sizes (CSS px) for the remove button — see the
// effectiveScale division below for why these can't just be plain numbers.
// 44px matches the standard minimum recommended touch-target size.
const BUTTON_SIZE = 44;
const ICON_SIZE = 20;
const BORDER_WIDTH = 2;

interface ElementsOverlayProps {
  templateRef: React.RefObject<HTMLDivElement>;
  elements: RemovableElement[];
  card: CardState;
  effectiveScale: number;
  onHide: (id: string) => void;
}

/**
 * Draws a dashed outline + a remove button over each currently-visible
 * removable element, measured live from the rendered DOM (data-element
 * attributes) rather than assumed positions — templates reflow when header/
 * footer/fontScale/format change, so fixed coordinates would drift.
 * Rendered as a sibling of the exported card node, so it never appears in
 * the PNG (same technique as the Instagram safe-zone overlay).
 */
export function ElementsOverlay({ templateRef, elements, card, effectiveScale, onHide }: ElementsOverlayProps) {
  const [boxes, setBoxes] = useState<ElementBox[]>([]);

  // No dependency array — re-measures after every render while this overlay
  // is mounted (only true while edit mode is on), so any reflow is caught
  // without having to track every prop that could cause one. Guarded by the
  // equality check below so it settles instead of looping: setBoxes only
  // replaces the array when a value actually changed, so once positions
  // stabilize this effect stops triggering further renders of its own.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately unbounded; the equality check inside settles it instead of a dep list
  useLayoutEffect(() => {
    const root = templateRef.current;
    if (!root) {
      setBoxes((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const next: ElementBox[] = [];
    for (const el of elements) {
      if (card.hiddenElements.includes(el.id)) continue; // already hidden — nothing to outline
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
    setBoxes((prev) => {
      const unchanged =
        prev.length === next.length &&
        prev.every((p, i) => {
          const n = next[i];
          return n.id === p.id && n.left === p.left && n.top === p.top && n.width === p.width && n.height === p.height;
        });
      return unchanged ? prev : next;
    });
  });

  // The overlay lives inside the same zoomed wrapper as the card, so a fixed
  // native-space (1080-design) size shrinks right along with the preview —
  // on mobile, where the preview is zoomed down a lot to leave room for the
  // control panel, that made the remove button too small to reliably tap.
  // Dividing by effectiveScale here keeps the button/icon/border at a
  // constant size on screen no matter how zoomed-out the preview is.
  const btnSize = BUTTON_SIZE / effectiveScale;
  const iconSize = ICON_SIZE / effectiveScale;
  const borderWidth = BORDER_WIDTH / effectiveScale;

  return (
    <>
      {boxes.map((b) => (
        <div
          key={b.id}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: b.width,
            height: b.height,
            border: `${borderWidth}px dashed rgba(99,102,241,0.9)`,
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={() => onHide(b.id)}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: btnSize,
              height: btnSize,
              borderRadius: '50%',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              border: 'none',
            }}
            className="flex items-center justify-center bg-gray-600/90 hover:bg-gray-700 text-white transition-colors"
          >
            <span style={{ width: iconSize, height: iconSize }}>
              <XIcon className="w-full h-full" />
            </span>
          </button>
        </div>
      ))}
    </>
  );
}
