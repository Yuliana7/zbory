import { useLayoutEffect, useState } from 'react';
import type { CardState } from '../../types';
import type { RemovableElement } from '../../utils/templateConfig';
import { XIcon } from '../../icons';

interface ElementBox {
  id: string;
  field: RemovableElement['field'];
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
  onHide: (field: RemovableElement['field']) => void;
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
      if (!card[el.field]) continue; // already hidden — nothing to outline
      const node = root.querySelector<HTMLElement>(`[data-element="${el.id}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      next.push({
        id: el.id,
        field: el.field,
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
            border: '3px dashed rgba(99,102,241,0.9)',
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={() => onHide(b.field)}
            style={{
              position: 'absolute',
              top: -16,
              right: -16,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#dc2626',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              border: 'none',
            }}
            className="flex items-center justify-center text-white hover:bg-red-700 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </>
  );
}
