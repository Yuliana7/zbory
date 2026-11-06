import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { ArrowLeftIcon } from '../../icons';

/** A page inside step 2: a way back to the analytics, a title, room for an action. */
export function SubPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation('insights');
  const { dispatch } = useAppContext();
  return (
    <div className="animate-fade-in">
      <button
        onClick={() => dispatch({ type: 'INSIGHTS_VIEW', payload: 'main' })}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {t('subpage.back')}
      </button>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 min-w-0">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-tight truncate">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}
