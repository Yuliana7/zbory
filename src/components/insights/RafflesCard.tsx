import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { RaffleStatus } from './RaffleStatus';

/** The project's raffles on the analytics page, each with where it stands. */
export function RafflesCard() {
  const { t } = useTranslation('insights');
  const { state, dispatch } = useAppContext();
  const { raffles = [], donations, friends } = state.app;
  const open = () => dispatch({ type: 'RAFFLES_EDIT_OPENED' });

  if (raffles.length === 0) {
    return (
      <button onClick={open} className="w-full bg-white rounded-2xl border border-dashed border-gray-300 p-4 text-sm font-medium text-indigo-600 hover:border-indigo-400 transition-colors">
        {t('raffles.addFirst')}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('raffles.title')}</p>
        <button onClick={open} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
          {t('raffles.manage')}
        </button>
      </div>
      <ul className="divide-y divide-gray-100">
        {[...raffles].reverse().map((r) => (
          <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-gray-900">{r.prize}</p>
            <RaffleStatus raffle={r} donations={donations ?? []} friends={friends} />
          </li>
        ))}
      </ul>
    </div>
  );
}
