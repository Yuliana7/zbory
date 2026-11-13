import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface ScrollXProps {
  children: ReactNode;
  /** classes for the outer box (border, radius, background) */
  className?: string;
  /** colour the edge fades blend into; match the box background */
  fadeFrom?: string;
}

/** A horizontally scrolling box that fades its edge while more content hides beyond it,
 * so a wide table on a phone visibly continues to the side (iOS hides scrollbars). */
export function ScrollX({ children, className = '', fadeFrom = 'from-white' }: ScrollXProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const fade = `pointer-events-none absolute inset-y-0 w-8 to-transparent transition-opacity duration-150 ${fadeFrom}`;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={ref} onScroll={measure} className="overflow-x-auto">
        {children}
      </div>
      <div aria-hidden className={`${fade} left-0 bg-gradient-to-r ${edges.left ? 'opacity-100' : 'opacity-0'}`} />
      <div aria-hidden className={`${fade} right-0 bg-gradient-to-l ${edges.right ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
