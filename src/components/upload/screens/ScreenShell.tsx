import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '../../../icons';

interface ScreenShellProps {
  title: ReactNode;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}

/** A focused full screen: one thing to change, a way back. */
export function ScreenShell({ title, backLabel, onBack, children }: ScreenShellProps) {
  return (
    <div className="py-8">
      <div className="max-w-xl mx-auto animate-fade-in">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {backLabel}
        </button>
        <h2 className="mb-5 text-2xl font-bold text-gray-900">{title}</h2>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
