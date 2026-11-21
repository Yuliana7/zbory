import { PlusIcon } from '../icons';

/** The page's one way to add, top right: «Додати банку» on the active jars, «З виписок» in the archive. */
export function TopAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-medium transition-colors"
    >
      <PlusIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
