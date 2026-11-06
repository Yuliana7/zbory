import { useTranslation } from 'react-i18next';
import type { FriendJar } from '../../types';
import type { useFriendsRefresh } from '../../hooks/useFriendsRefresh';
import { RefreshIcon, SpinnerIcon } from '../../icons';
import { fmtUah, type FriendStats } from '../../utils/friendJars';
import { dataAsOf, formatWhen, linkedOpen } from '../../utils/friendsRefresh';

type Refresh = ReturnType<typeof useFriendsRefresh>;

export function RefreshButton({ refresh }: { refresh: Refresh }) {
  const { t } = useTranslation('insights');
  return (
    <button
      onClick={refresh.refreshNow}
      disabled={refresh.running}
      title={t('friends.refreshHint')}
      className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
    >
      {refresh.running ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
      {t('friends.refresh')}
    </button>
  );
}

/** Where the numbers come from: while jars are being read, how far along; afterwards, how fresh they are. */
export function FriendsFreshness({ friends, refresh }: { friends: FriendJar[]; refresh: Refresh }) {
  const { t } = useTranslation('insights');
  const linked = linkedOpen(friends).length;
  const asOf = dataAsOf(friends);
  return (
    <>
      {refresh.running ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-indigo-600" role="status">
          <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
          {refresh.progress ? t('friends.refreshing', refresh.progress) : t('friends.refreshingShort')}
        </p>
      ) : (
        linked > 0 && <p className="mb-3 text-xs text-gray-500">🔄 {asOf ? t('friends.asOf', { when: formatWhen(asOf) }) : t('friends.neverSynced')}</p>
      )}
      {!refresh.running && refresh.outcome && (refresh.outcome.rateLimited || refresh.outcome.failed > 0) && (
        <p className="mb-3 text-xs text-amber-700">
          {refresh.outcome.rateLimited
            ? t('friends.refreshRateLimited', { updated: refresh.outcome.updated })
            : t('friends.refreshFailed', { updated: refresh.outcome.updated, failed: refresh.outcome.failed })}
        </p>
      )}
    </>
  );
}

/** All helpers together against all their targets (the bar is full at 100%; the number may go past it). */
export function TargetsBar({ stats }: { stats: FriendStats }) {
  const { t } = useTranslation('insights');
  const { total, targetsTotal, targetsProgress, withoutTarget } = stats;
  if (targetsProgress === null) return null;
  const reached = targetsProgress >= 1;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs text-gray-500">
        <span>{t('friends.targetsBar', { raised: fmtUah(total), target: fmtUah(targetsTotal) })}</span>
        <span className={`shrink-0 font-semibold ${reached ? 'text-green-600' : 'text-indigo-600'}`}>{Math.round(targetsProgress * 100)}%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${reached ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${Math.min(1, targetsProgress) * 100}%` }} />
      </div>
      {withoutTarget > 0 && <p className="mt-1.5 text-[11px] text-gray-400">{t('friends.targetsBarNote', { count: withoutTarget })}</p>}
    </div>
  );
}
