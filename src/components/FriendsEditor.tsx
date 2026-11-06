import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { useFriendsDraft, type FriendsDraft } from '../hooks/useFriendsDraft';
import { CheckIcon } from '../icons';
import { downloadCSV } from '../utils/csvExporter';
import { computeFriendStats, friendsToCSV, rowsToFriends, type FriendDraftRow } from '../utils/friendJars';
import { FRIEND_COLUMNS, FriendRow } from './friends/FriendRow';
import { AddByIdPanel } from './friends/AddByIdPanel';

/** Helper ("friendly") jars of the open campaign: a name, how much each one raised, optionally what
 * it set out to raise (its target — progress can go past 100%), and — for a jar linked by its long id —
 * its status. Attribution only: those donations are already inside the main jar's totals, so nothing
 * here ever changes a total. Edits stay in a draft until «Зберегти» is pressed; a page that must
 * warn before leaving passes in its own `draft`. */
export function FriendsEditor({ draft: external }: { draft?: FriendsDraft }) {
  const { t } = useTranslation('export');
  const { state } = useAppContext();
  const { app } = state;
  const own = useFriendsDraft();
  const draft = external ?? own;
  const { rows, setRows, dirty, duplicates, save, discard, busyIds, rowErrors } = draft;
  const [addingById, setAddingById] = useState(false);

  const mainTotal = app.aggregates?.totalAmount ?? (app.donations ?? []).reduce((sum, d) => sum + d.amount, 0);

  const patch = (id: string, change: Partial<FriendDraftRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const stats = computeFriendStats(app.friends, mainTotal); // what is saved, not the draft

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t('friends.hint')}</p>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* the totals, where the eyes start; the actions on the other side */}
        <p className="text-xs text-gray-500">
          {stats.total > 0 ? (
            <>
              {t('friends.summary', {
                amount: new Intl.NumberFormat('uk-UA').format(Math.round(stats.total)),
                pct: Math.round(stats.share * 100),
              })}
              {stats.withTarget > 0 && ` · ${t('friends.reachedSummary', { reached: stats.reached, total: stats.withTarget })}`}
            </>
          ) : stats.withTarget > 0 ? (
            t('friends.reachedSummary', { reached: stats.reached, total: stats.withTarget })
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {rows.length > 0 && (
            <button
              onClick={() => {
                const d = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                void downloadCSV(friendsToCSV(rowsToFriends(rows, app.friends)), `druzi_zboru_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`);
              }}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
            >
              {t('friends.csv')}
            </button>
          )}
          <button
            onClick={() => setAddingById((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
          >
            {t('friends.addById.toggle')}
          </button>
        </div>
      </div>
      {dirty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-sm text-amber-800">{t('friends.unsaved')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
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
        // only once something has actually been saved — an empty or still-blank form is not "saved"
        (app.friends?.length ?? 0) > 0 &&
        (app.activeCampaignId ? (
          <p className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckIcon className="w-3.5 h-3.5" />
            {t('friends.saved')}
          </p>
        ) : (
          <p className="text-xs text-gray-500">{t('friends.savedSession')}</p>
        ))
      )}
      {addingById && <AddByIdPanel draft={draft} onClose={() => setAddingById(false)} />}

      {rows.length > 0 && (
        <div
          aria-hidden="true"
          className={`hidden sm:grid gap-2 px-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 ${FRIEND_COLUMNS}`}
        >
          <span>{t('friends.columns.name')}</span>
          <span>{t('friends.columns.raised')}</span>
          <span>{t('friends.columns.target')}</span>
          <span className="text-center">{t('friends.columns.progress')}</span>
          <span>{t('friends.columns.status')}</span>
          <span />
        </div>
      )}
      <div className="space-y-2">
        {/* the list is kept in the order helpers were added; the newest shows first */}
        {[...rows].reverse().map((r) => (
          <FriendRow
            key={r.id}
            row={r}
            duplicate={duplicates.has(r.id)}
            busy={busyIds.includes(r.id)}
            error={rowErrors[r.id]}
            onChange={(change) => patch(r.id, change)}
            onRemove={() => remove(r.id)}
            onRefresh={() => draft.refreshOne(r.id)}
            onLink={(input) => draft.linkJar(r.id, input)}
            onUnlink={() => draft.unlinkJar(r.id)}
          />
        ))}
      </div>
      {stats.exceedsTotal && <p className="text-xs text-red-500">{t('friends.exceeds')}</p>}
    </div>
  );
}
