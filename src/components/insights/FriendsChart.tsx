import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { FriendJar } from '../../types';
import type { RenewAll } from '../../hooks/useRenewAll';
import { computeFriendStats, fmtUah, formatSharePct, friendBar, latestModified, FRIENDS_PREVIEW } from '../../utils/friendJars';
import { FriendsFreshness, TargetsBar } from './friendsShared';

interface FriendsChartProps {
  friends: FriendJar[];
  /** the main jar's total — helpers are a share OF it, never added to it */
  totalAmount: number;
  renew: RenewAll;
}

/** A preview of the helper jars on the analytics page: the totals and the most recently changed jars.
 * «Детальніше» opens the page with all of them. A helper with a target gets a bar towards it; until
 * anyone has a target the bars compare helpers with the best one. */
export function FriendsChart({ friends, totalAmount, renew }: FriendsChartProps) {
  const { t } = useTranslation('insights');
  const { dispatch } = useAppContext();
  const stats = computeFriendStats(friends, totalAmount);
  const { ranked, total, share, exceedsTotal, withTarget, reached } = stats;

  // nothing to show yet: the way in, since step 1 no longer asks about helpers
  if (ranked.length === 0) {
    return (
      <button
        onClick={() => dispatch({ type: 'FRIENDS_EDIT_OPENED' })}
        className="w-full bg-white rounded-2xl border border-dashed border-gray-300 p-4 text-sm font-medium text-indigo-600 hover:border-indigo-400 transition-colors"
      >
        {t('friends.addFirst')}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('friends.title')}</p>
        <button
          onClick={() => dispatch({ type: 'INSIGHTS_VIEW', payload: 'friends' })}
          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {t('friends.viewMore')}
        </button>
      </div>

      {/* the headline, across the whole box: how much the helpers brought and how many hit their target */}
      <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">
        {t('friends.summary', { amount: fmtUah(total), pct: formatSharePct(share), n: ranked.length })}
        {/* the dot stays at the end of the first part, so a wrapped line never starts with it */}
        {withTarget > 0 && <span className="text-indigo-500">&nbsp;· {t('friends.reachedSummary', { reached, total: withTarget })}</span>}
      </p>

      <FriendsFreshness friends={friends} renew={renew} />
      <div className="mb-5 empty:hidden"><TargetsBar stats={stats} /></div>

      <div className="space-y-3">
        {latestModified(ranked).slice(0, FRIENDS_PREVIEW).map((f) => {
          const bar = friendBar(f, ranked);
          return (
            <div key={f.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                <span className="min-w-0 truncate font-medium text-gray-800">
                  {f.name || '—'}
                  {bar.reached && <span className="ml-2 text-green-600" title={t('friends.reachedBadge')}>✓</span>}
                  {f.closed && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{t('friends.closed')}</span>}
                </span>
                <span className="shrink-0 whitespace-nowrap">
                  <span className="font-semibold text-gray-900">{fmtUah(f.raised)} ₴</span>
                  <span className="text-xs text-gray-400 ml-2">{formatSharePct(f.raised / totalAmount)}%</span>
                </span>
              </div>
              {bar.mode !== 'none' && (
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${bar.reached ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${bar.fill * 100}%` }} />
                </div>
              )}
              {bar.pct !== null && f.target && (
                <p className={`mt-1 text-xs ${bar.reached ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                  {t('friends.ofTarget', { pct: Math.round(bar.pct), target: fmtUah(f.target) })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {ranked.length > FRIENDS_PREVIEW && (
        <button
          onClick={() => dispatch({ type: 'INSIGHTS_VIEW', payload: 'friends' })}
          className="mt-4 w-full rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors"
        >
          {t('friends.viewAll', { count: ranked.length })}
        </button>
      )}

      {exceedsTotal && <p className="mt-3 text-xs text-red-500">{t('friends.exceeds')}</p>}
    </div>
  );
}
