import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon } from '../../../icons';

interface ScreenShellProps {
  title: ReactNode;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
  /** room for a table instead of a single column */
  wide?: boolean;
  /** buttons next to the title */
  actions?: ReactNode;
  /** keep the title and its buttons pinned to the top while a long list scrolls */
  stickyHeader?: boolean;
}

/** A focused full screen: one thing to change, a way back. */
export function ScreenShell({ title, backLabel, onBack, children, wide = false, actions, stickyHeader = false }: ScreenShellProps) {
  // an empty marker right above the title bar: once it scrolls out of sight the bar has pinned
  const markerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const marker = markerRef.current;
    if (!stickyHeader || !marker || !barRef.current) return;
    const top = parseFloat(getComputedStyle(barRef.current).top) || 0; // the status-bar inset, in px
    const observer = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting), { rootMargin: `-${top + 1}px 0px 0px 0px` });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [stickyHeader]);

  return (
    <div className="py-8">
      <div className={`${wide ? 'max-w-3xl' : 'max-w-xl'} mx-auto animate-fade-in`}>
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {backLabel}
        </button>
        {stickyHeader && <div ref={markerRef} aria-hidden="true" />}
        <div
          ref={barRef}
          className={
            stickyHeader
              ? `sticky z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-2 flex flex-wrap items-center justify-between gap-2 transition-[background-color,box-shadow] duration-150 ${
                  pinned ? 'bg-white/90 backdrop-blur-md shadow-sm' : ''
                }`
              : 'mb-5 flex flex-wrap items-center justify-between gap-3'
          }
          style={stickyHeader ? { top: 'var(--safe-top)' } : undefined}
        >
          <h2 className={`${stickyHeader ? 'text-xl sm:text-2xl' : 'text-2xl'} font-bold text-gray-900`}>{title}</h2>
          {actions}
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
