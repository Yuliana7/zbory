import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { PlusIcon, TrashIcon } from '../icons';
import { cleanFriends, computeFriendStats, newFriend, parseAmount } from '../utils/friendJars';

interface Row {
  id: string;
  name: string;
  raised: string; // what's typed — parsed on commit
}

const INPUT =
  // text-base (16px): anything smaller makes iOS zoom the page on focus
  'px-3 py-2 rounded-lg border border-gray-200 bg-white text-base text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400';

/** Helper ("friendly") jars of the open campaign: a name and how much each one
 * raised. Attribution only — those donations are already inside the main
 * jar's totals, so nothing here ever changes a total. Rows are edited as text
 * and committed to app state on blur, so typing doesn't re-render the cards. */
export function FriendsEditor() {
  const { t } = useTranslation('export');
  const { state, handleFriendsChange } = useAppContext();
  const { app } = state;
  const [rows, setRows] = useState<Row[]>(() =>
    (app.friends ?? []).map((f) => ({ id: f.id, name: f.name, raised: f.raised ? String(f.raised) : '' })),
  );

  const mainTotal = app.aggregates?.totalAmount ?? (app.donations ?? []).reduce((sum, d) => sum + d.amount, 0);

  const commit = (next: Row[]) =>
    handleFriendsChange(cleanFriends(next.map((r) => ({ id: r.id, name: r.name, raised: parseAmount(r.raised) ?? 0 }))));

  const patch = (id: string, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const add = () => setRows((rs) => [...rs, { id: newFriend().id, name: '', raised: '' }]);

  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    commit(next);
  };

  const stats = computeFriendStats(app.friends, mainTotal);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t('friends.hint')}</p>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <input
            type="text"
            value={r.name}
            onChange={(e) => patch(r.id, { name: e.target.value })}
            onBlur={() => commit(rows)}
            placeholder={t('friends.namePlaceholder')}
            className={`${INPUT} flex-1 min-w-0`}
          />
          <input
            type="text"
            inputMode="decimal"
            value={r.raised}
            onChange={(e) => patch(r.id, { raised: e.target.value })}
            onBlur={() => commit(rows)}
            placeholder={t('friends.amountPlaceholder')}
            className={`${INPUT} w-28 shrink-0`}
          />
          <button
            onClick={() => remove(r.id)}
            title={t('friends.remove')}
            className="p-2 text-gray-300 hover:text-red-500 transition-colors shrink-0"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                   bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        {t('friends.add')}
      </button>
      {stats.total > 0 && (
        <p className="text-xs text-gray-500">
          {t('friends.summary', {
            amount: new Intl.NumberFormat('uk-UA').format(Math.round(stats.total)),
            pct: Math.round(stats.share * 100),
          })}
        </p>
      )}
      {stats.exceedsTotal && <p className="text-xs text-red-500">{t('friends.exceeds')}</p>}
    </div>
  );
}
