import type { ReactNode } from 'react';
import { ChevronDownIcon } from '../../../icons';

interface CollapsibleSectionProps {
  title: ReactNode;
  /** what is set right now, shown under the title while the section is closed */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** An optional part of the preview page: a one-line row that opens into its form. */
export function CollapsibleSection({ title, summary, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {summary && !open && <p className="mt-0.5 text-sm text-gray-500 truncate">{summary}</p>}
        </div>
        <ChevronDownIcon className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-gray-100 animate-fade-in">{children}</div>}
    </section>
  );
}
