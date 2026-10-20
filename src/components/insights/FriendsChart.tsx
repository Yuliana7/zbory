import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { FriendJar } from '../../types';
import { useFriendsRefresh } from '../../hooks/useFriendsRefresh';
import { RefreshIcon, SpinnerIcon } from '../../icons';
import { downloadCSV } from '../../utils/csvExporter';
import { computeFriendStats, formatSharePct, friendBar, friendsToCSV, latestModified, pageOf, FRIENDS_PAGE_SIZE } from '../../utils/friendJars';
import { dataAsOf, formatWhen, linkedOpen } from '../../utils/friendsRefresh';

interface FriendsChartProps {
  friends: FriendJar[];
  /** the main jar's total — helpers are a share OF it, never added to it */
  totalAmount: number;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** How much each helper jar brought in, read-only. A helper with a target gets a bar towards that
 * target (full, with a check mark, once reached — the percentage can go past 100); until anyone has a
 * target the bars compare helpers with the best one. The top bar shows the helpers' share of the whole
 * jar. Helpers are listed five at a time, the most recently changed first. Editing happens on the
 * friends screen of step 1, not here. */
export function FriendsChart({ friends, totalAmount }: FriendsChartProps) {
  const { t } = useTranslation('insights');
  const { dispatch } = useAppContext();
  const [page, setPage] = useState(0);
  const refresh = useFriendsRefresh(friends);
  const { ranked, total, share, exceedsTotal, withTarget, reached } = computeFriendStats(friends, totalAmount);

  if (ranked.length === 0) return null;

  const shown = pageOf(latestModified(ranked), page);
  const linked = linkedOpen(friends).length;
  const asOf = dataAsOf(friends);
  const stamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const from = shown.page * FRIENDS_PAGE_SIZE + 1;
  const to = from + shown.items.length - 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('friends.title')}</p>
          <p className="text-sm text-gray-600 mt-1">
            {t('friends.summary', { amount: fmt(total), pct: formatSharePct(share), n: ranked.length })}
          </p>
          {withTarget > 0 && (
            <p className="text-sm text-gray-600">{t('friends.reachedSummary', { reached, total: withTarget })}</p>
          )}
          {/* where the numbers come from: while jars are being read, how far along; afterwards, how fresh they are */}
          {refresh.running ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-indigo-600" role="status">
              <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
              {refresh.progress ? t('friends.refreshing', refresh.progress) : t('friends.refreshingShort')}
            </p>
          ) : (
            linked > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                🔄 {asOf ? t('friends.asOf', { when: formatWhen(asOf) }) : t('friends.neverSynced')}
              </p>
            )
          )}
          {!refresh.running && refresh.outcome && (refresh.outcome.rateLimited || refresh.outcome.failed > 0) && (
            <p className="mt-1 text-xs text-amber-700">
              {refresh.outcome.rateLimited
                ? t('friends.refreshRateLimited', { updated: refresh.outcome.updated })
                : t('friends.refreshFailed', { updated: refresh.outcome.updated, failed: refresh.outcome.failed })}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {linked > 0 && (
            <button
              onClick={refresh.refreshNow}
              disabled={refresh.running}
              title={t('friends.refreshHint')}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
            >
              {refresh.running ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
              {t('friends.refresh')}
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'FRIENDS_EDIT_OPENED' })}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {t('friends.edit')}
          </button>
        </div>
      </div>

      {/* Helpers' share of the whole jar */}
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-5" title={t('friends.shareBar')}>
        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${share * 100}%` }} />
      </div>

      <div className="space-y-3">
        {shown.items.map((f) => {
          const bar = friendBar(f, ranked);
          return (
            <div key={f.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                <span className="min-w-0 truncate font-medium text-gray-800">
                  {f.name || '—'}
                  {refresh.progress?.current === f.id && (
                    <SpinnerIcon className="ml-2 inline w-3 h-3 animate-spin text-indigo-500" />
                  )}
                  {bar.reached && <span className="ml-2 text-green-600" title={t('friends.reachedBadge')}>✓</span>}
                  {f.closed && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      {t('friends.closed')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap">
                  <span className="font-semibold text-gray-900">{fmt(f.raised)} ₴</span>
                  <span className="text-xs text-gray-400 ml-2">{formatSharePct(f.raised / totalAmount)}%</span>
                </span>
              </div>
              {bar.mode !== 'none' && (
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bar.reached ? 'bg-green-500' : 'bg-indigo-400'}`}
                    style={{ width: `${bar.fill * 100}%` }}
                  />
                </div>
              )}
              {bar.pct !== null && f.target && (
                <p className={`mt-1 text-xs ${bar.reached ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                  {t('friends.ofTarget', { pct: Math.round(bar.pct), target: fmt(f.target) })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {shown.pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
          <button
            onClick={() => setPage(shown.page - 1)}
            disabled={shown.page === 0}
            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 font-medium text-gray-700 transition-colors"
          >
            ‹ {t('friends.prev')}
          </button>
          <span>{t('friends.pageRange', { from, to, total: ranked.length })}</span>
          <button
            onClick={() => setPage(shown.page + 1)}
            disabled={shown.page >= shown.pages - 1}
            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 font-medium text-gray-700 transition-colors"
          >
            {t('friends.next')} ›
          </button>
        </div>
      )}
      {shown.pages > 1 && <p className="mt-2 text-[11px] text-gray-400">{t('friends.latestNote')}</p>}

      {exceedsTotal && <p className="mt-3 text-xs text-red-500">{t('friends.exceeds')}</p>}

      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-gray-500">
        {linked > 0 ? (
          <button
            onClick={() => refresh.setAuto(!refresh.auto)}
            aria-pressed={refresh.auto}
            title={t('friends.autoHint')}
            className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
          >
            <span className={`inline-block w-7 h-4 rounded-full relative transition-colors ${refresh.auto ? 'bg-indigo-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${refresh.auto ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            {t('friends.auto')}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => downloadCSV(friendsToCSV(friends), `druzi_zboru_${stamp()}.csv`)}
          className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {t('friends.csv')}
        </button>
      </div>
    </div>
  );
}
