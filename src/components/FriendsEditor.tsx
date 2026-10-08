import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { useFriendsDraft, type FriendsDraft } from '../hooks/useFriendsDraft';
import { CheckIcon, PlusIcon, TrashIcon } from '../icons';
import { computeFriendStats, friendProgress, newFriend, parseAmount, type FriendDraftRow } from '../utils/friendJars';

const INPUT =
  // text-base (16px): anything smaller makes iOS zoom the page on focus
  'px-3 py-2 rounded-lg border border-gray-200 bg-white text-base text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400';

/** Helper ("friendly") jars of the open campaign: a name, how much each one raised and,
 * optionally, what it set out to raise (its target — progress can go past 100%).
 * Attribution only — those donations are already inside the main jar's totals, so nothing
 * here ever changes a total. Edits stay in a draft until «Зберегти» is pressed; a page that
 * must warn before leaving passes in its own `draft`. */
export function FriendsEditor({ draft: external }: { draft?: FriendsDraft }) {
  const { t } = useTranslation('export');
  const { state } = useAppContext();
  const { app } = state;
  const own = useFriendsDraft();
  const { rows, setRows, dirty, duplicates, save, discard } = external ?? own;

  const mainTotal = app.aggregates?.totalAmount ?? (app.donations ?? []).reduce((sum, d) => sum + d.amount, 0);

  const patch = (id: string, change: Partial<FriendDraftRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const add = () => setRows((rs) => [...rs, { id: newFriend().id, name: '', raised: '', target: '' }]);

  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const stats = computeFriendStats(app.friends, mainTotal); // what is saved, not the draft

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
                placeholder={t('friends.namePlaceholder')}
                aria-label={t('friends.namePlaceholder')}
                aria-invalid={duplicates.has(r.id)}
                className={`${INPUT} min-w-0 ${duplicates.has(r.id) ? 'border-red-400 focus:ring-red-300' : ''}`}
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
                  placeholder={t('friends.amountPlaceholder')}
                  aria-label={t('friends.amountPlaceholder')}
                  className={`${INPUT} min-w-0`}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={r.target}
                  onChange={(e) => patch(r.id, { target: e.target.value })}
                  placeholder={t('friends.targetPlaceholder')}
                  aria-label={t('friends.targetPlaceholder')}
                  className={`${INPUT} min-w-0`}
                />
              </div>
            </div>
            {duplicates.has(r.id) && <p className="mt-1 text-xs text-red-500">{t('friends.duplicate')}</p>}
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
      {dirty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-sm text-amber-800">{t('friends.unsaved')}</p>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={duplicates.size > 0}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckIcon className="w-4 h-4" />
              {t('friends.save')}
            </button>
            <button
              onClick={discard}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              {t('friends.discard')}
            </button>
          </div>
        </div>
      ) : (
        rows.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckIcon className="w-3.5 h-3.5" />
            {t('friends.saved')}
          </p>
        )
      )}
    </div>
  );
}
