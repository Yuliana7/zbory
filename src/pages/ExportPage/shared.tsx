import type { ReactNode } from 'react';
import { ChevronDownIcon } from '../../icons';

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-indigo-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
    </label>
  );
}

// ─── Collapsible sidebar section ─────────────────────────────────────────────

export function Collapsible({
  label, open, onToggle, children,
  badge, badgeColor, icon, purple,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
  badge?: string;
  badgeColor?: 'indigo' | 'gray';
  icon?: string;
  purple?: boolean;
}) {
  return (
    <div className={`rounded-xl border overflow-hidden ${purple ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${purple ? 'hover:bg-purple-100' : 'hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <span className={`text-sm font-semibold ${purple ? 'text-purple-900' : 'text-gray-700'}`}>{label}</span>
          {badge && (
            <span className={`text-xs font-medium ${badgeColor === 'indigo' ? 'text-indigo-600' : 'text-gray-400 font-mono'}`}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${purple ? 'text-purple-400' : 'text-gray-400'}`} />
      </button>
      {open && (
        <div className={`px-4 pb-4 pt-3 border-t ${purple ? 'border-purple-200' : 'border-gray-100'}`}>
          {children}
        </div>
      )}
    </div>
  );
}
