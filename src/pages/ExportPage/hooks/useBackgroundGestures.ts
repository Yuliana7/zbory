import { useRef, useEffect, type RefObject } from 'react';
import type { SharedStyle } from '../../../types';

interface PointerPos {
  x: number;
  y: number;
}

// Reference geometry + style values captured whenever the set of active
// pointers changes, so every subsequent move computes a delta from a fixed
// anchor instead of drifting frame-to-frame.
interface GestureBase {
  offsetX: number;
  offsetY: number;
  zoom: number;
  rotate: number;
  dist: number; // distance between the two pointers (0 for a single pointer)
  angle: number; // degrees, atan2 of the two-pointer vector
  cx: number;
  cy: number; // centroid, screen px
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Drag-to-pan, pinch-to-zoom and two-finger rotate for a card's background
 * photo, isolated to the full-screen editor overlay (the overlay owns the
 * whole viewport, so touch-action: none on its gesture surface — set by the
 * caller — never fights page scroll the way it would on the small inline
 * preview). A single active pointer pans; two pan-by-centroid, scale by
 * distance ratio and rotate by angle delta, all relative to a base snapshot
 * taken whenever the pointer count changes. Mouse wheel still zooms, for
 * desktop users with no pinch gesture.
 */
export function useBackgroundGestures(
  clipRef: RefObject<HTMLDivElement>,
  style: SharedStyle,
  patchStyle: (patch: Partial<SharedStyle>) => void,
  previewW: number,
  previewH: number,
) {
  const pointers = useRef(new Map<number, PointerPos>());
  const base = useRef<GestureBase | null>(null);

  // Latest style/patch accessible from the non-React wheel listener and from
  // handlers without re-subscribing on every style change.
  const styleRef = useRef(style);
  styleRef.current = style;
  const patchStyleRef = useRef(patchStyle);
  patchStyleRef.current = patchStyle;

  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clamp(styleRef.current.bgZoom + (e.deltaY < 0 ? 0.08 : -0.08), 1, 3);
      patchStyleRef.current({ bgZoom: Math.round(next * 100) / 100 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clipRef]);

  // Re-anchors `base` from the currently tracked pointers + committed style —
  // called on every pointer count change so a finger lifting/landing never
  // causes a jump in the next move event.
  const snapshotBase = () => {
    const pts = [...pointers.current.values()];
    const s = styleRef.current;
    if (pts.length === 0) {
      base.current = null;
      return;
    }
    const shared = { offsetX: s.bgOffsetX, offsetY: s.bgOffsetY, zoom: s.bgZoom, rotate: s.bgRotate };
    if (pts.length >= 2) {
      // Only the first two tracked pointers drive the gesture; a third
      // simultaneous touch is tracked (for a clean handoff if one of the
      // first two lifts) but otherwise ignored.
      const [a, b] = pts;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      base.current = {
        ...shared,
        dist: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx) * (180 / Math.PI),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    } else {
      base.current = { ...shared, dist: 0, angle: 0, cx: pts[0].x, cy: pts[0].y };
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!styleRef.current.bgImage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshotBase();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !base.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const b = base.current;

    if (pts.length >= 2) {
      const [a, c] = pts;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const cx = (a.x + c.x) / 2;
      const cy = (a.y + c.y) / 2;

      const zoom = clamp(b.zoom * (dist / (b.dist || dist || 1)), 1, 3);
      const rotate = norm360(b.rotate + (angle - b.angle));
      const offsetX = clamp(b.offsetX + ((cx - b.cx) / previewW) * 100, -100, 100);
      const offsetY = clamp(b.offsetY + ((cy - b.cy) / previewH) * 100, -100, 100);

      patchStyleRef.current({
        bgZoom: Math.round(zoom * 100) / 100,
        bgRotate: Math.round(rotate),
        bgOffsetX: Math.round(offsetX),
        bgOffsetY: Math.round(offsetY),
      });
    } else {
      const p = pts[0];
      const offsetX = clamp(b.offsetX + ((p.x - b.cx) / previewW) * 100, -100, 100);
      const offsetY = clamp(b.offsetY + ((p.y - b.cy) / previewH) * 100, -100, 100);
      patchStyleRef.current({ bgOffsetX: Math.round(offsetX), bgOffsetY: Math.round(offsetY) });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    snapshotBase();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
