import type { ReactNode } from 'react';
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
}

/** A focused full screen: one thing to change, a way back. */
export function ScreenShell({ title, backLabel, onBack, children, wide = false, actions }: ScreenShellProps) {
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {actions}
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
