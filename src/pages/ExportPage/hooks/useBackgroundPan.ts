import { useRef, useEffect, type RefObject } from 'react';
import type { SharedStyle } from '../../../types';

/**
 * Drag-to-reposition and wheel-to-zoom for a card's background photo.
 * Wheel listens on previewClipRef directly (non-passive, to block page
 * scroll); drag handlers are meant to be spread onto that same element.
 */
export function useBackgroundPan(
  previewClipRef: RefObject<HTMLDivElement>,
  style: SharedStyle,
  patchStyle: (patch: Partial<SharedStyle>) => void,
  elementsEditMode: boolean,
  previewW: number,
  previewH: number,
) {
  const bgDrag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Latest style/patch accessible from the non-React wheel listener
  const styleRef = useRef(style);
  styleRef.current = style;
  const patchStyleRef = useRef(patchStyle);
  patchStyleRef.current = patchStyle;
  const elementsEditModeRef = useRef(elementsEditMode);
  elementsEditModeRef.current = elementsEditMode;

  // Wheel over the preview zooms the background photo (non-passive to prevent page scroll)
  useEffect(() => {
    const el = previewClipRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!styleRef.current.bgImage || elementsEditModeRef.current) return;
      e.preventDefault();
      const next = Math.min(3, Math.max(1, styleRef.current.bgZoom + (e.deltaY < 0 ? 0.08 : -0.08)));
      patchStyleRef.current({ bgZoom: Math.round(next * 100) / 100 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [previewClipRef]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!style.bgImage || elementsEditMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    bgDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: style.bgOffsetX,
      baseY: style.bgOffsetY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!bgDrag.current) return;
    // Screen px → % of the card (the img translate % is relative to card size)
    const dxPct = ((e.clientX - bgDrag.current.startX) / previewW) * 100;
    const dyPct = ((e.clientY - bgDrag.current.startY) / previewH) * 100;
    patchStyle({
      bgOffsetX: Math.round(Math.min(100, Math.max(-100, bgDrag.current.baseX + dxPct))),
      bgOffsetY: Math.round(Math.min(100, Math.max(-100, bgDrag.current.baseY + dyPct))),
    });
  };

  const onPointerUp = () => {
    bgDrag.current = null;
  };

  const cursor = elementsEditMode ? undefined : style.bgImage ? (bgDrag.current ? 'grabbing' : 'grab') : undefined;

  return { onPointerDown, onPointerMove, onPointerUp, cursor };
}
