import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { PlusIcon, TrashIcon } from '../icons';
import { cleanFriends, computeFriendStats, friendProgress, newFriend, parseAmount } from '../utils/friendJars';

interface Row {
  id: string;
  name: string;
  raised: string; // what's typed — parsed on commit
  target: string; // optional; parsed on commit
}

const INPUT =
  // text-base (16px): anything smaller makes iOS zoom the page on focus
  'px-3 py-2 rounded-lg border border-gray-200 bg-white text-base text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400';

/** Helper ("friendly") jars of the open campaign: a name, how much each one raised and,
 * optionally, what it set out to raise (its target — progress can go past 100%).
 * Attribution only — those donations are already inside the main jar's totals, so nothing
 * here ever changes a total. Rows are edited as text and committed to app state on blur,
 * so typing doesn't re-render the cards. */
export function FriendsEditor() {
  const { t } = useTranslation('export');
  const { state, handleFriendsChange } = useAppContext();
  const { app } = state;
  const [rows, setRows] = useState<Row[]>(() =>
    (app.friends ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      raised: f.raised ? String(f.raised) : '',
      target: f.target ? String(f.target) : '',
    })),
  );

  const mainTotal = app.aggregates?.totalAmount ?? (app.donations ?? []).reduce((sum, d) => sum + d.amount, 0);

  const commit = (next: Row[]) =>
    handleFriendsChange(
      cleanFriends(
        next.map((r) => {
          const target = parseAmount(r.target);
          return { id: r.id, name: r.name, raised: parseAmount(r.raised) ?? 0, ...(target ? { target } : null) };
        }),
      ),
    );

  const patch = (id: string, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const add = () => setRows((rs) => [...rs, { id: newFriend().id, name: '', raised: '', target: '' }]);

  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    commit(next);
  };

  const stats = computeFriendStats(app.friends, mainTotal);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t('friends.hint')}</p>
      {rows.map((r) => {
        // Progress as the user has typed it so far, so the row answers "is that a hit?" at once
        const progress = friendProgress({
          id: r.id,
          name: r.name,
          raised: parseAmount(r.raised) ?? 0,
          target: parseAmount(r.target) ?? undefined,
        });
        return (
          <div key={r.id}>
            {/* phone: name + delete on the first line, the two amounts on the second; wider: all in one row */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-center">
              <input
                type="text"
                value={r.name}
                onChange={(e) => patch(r.id, { name: e.target.value })}
                onBlur={() => commit(rows)}
                placeholder={t('friends.namePlaceholder')}
                aria-label={t('friends.namePlaceholder')}
                className={`${INPUT} min-w-0`}
              />
              <button
                onClick={() => remove(r.id)}
                title={t('friends.remove')}
                aria-label={t('friends.remove')}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors sm:col-start-4 sm:row-start-1"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
              <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
                <input
                  type="text"
                  inputMode="decimal"
                  value={r.raised}
                  onChange={(e) => patch(r.id, { raised: e.target.value })}
                  onBlur={() => commit(rows)}
                  placeholder={t('friends.amountPlaceholder')}
                  aria-label={t('friends.amountPlaceholder')}
                  className={`${INPUT} min-w-0`}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={r.target}
                  onChange={(e) => patch(r.id, { target: e.target.value })}
                  onBlur={() => commit(rows)}
                  placeholder={t('friends.targetPlaceholder')}
                  aria-label={t('friends.targetPlaceholder')}
                  className={`${INPUT} min-w-0`}
                />
              </div>
            </div>
            {progress.pct !== null && (
              <p className={`mt-1 text-xs ${progress.reached ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {progress.reached ? '✓ ' : ''}
                {t('friends.progress', { pct: Math.round(progress.pct) })}
                {progress.reached ? ` · ${t('friends.reachedBadge')}` : ''}
              </p>
            )}
          </div>
        );
      })}
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
      {stats.withTarget > 0 && (
        <p className="text-xs text-gray-500">{t('friends.reachedSummary', { reached: stats.reached, total: stats.withTarget })}</p>
      )}
      {stats.exceedsTotal && <p className="text-xs text-red-500">{t('friends.exceeds')}</p>}
    </div>
  );
}
