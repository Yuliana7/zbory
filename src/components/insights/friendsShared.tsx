import { useTranslation } from 'react-i18next';
import type { FriendJar } from '../../types';
import type { RenewAll } from '../../hooks/useRenewAll';
import { RefreshIcon, SpinnerIcon } from '../../icons';
import { fmtUah, type FriendStats } from '../../utils/friendJars';
import { dataAsOf, formatWhen, linkedOpen } from '../../utils/friendsRefresh';

/** The page's renew again, for the friends page, which has no main-total block. */
export function RenewButton({ renew }: { renew: RenewAll }) {
  const { t } = useTranslation('insights');
  return (
    <button
      onClick={renew.running ? renew.stop : renew.renew}
      title={t('friends.refreshHint')}
      className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
    >
      {renew.running ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
      {renew.running ? t('renew.stop') : t('renew.button')}
    </button>
  );
}

/** How fresh the helper numbers are; while a renew reads them, how far along it is. */
export function FriendsFreshness({ friends, renew }: { friends: FriendJar[]; renew: RenewAll }) {
  const { t } = useTranslation('insights');
  const asOf = dataAsOf(friends);
  if (renew.running && renew.linkedJars > 0) {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-xs text-indigo-600" role="status">
        <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
        {renew.jarsProgress ? t('friends.refreshing', renew.jarsProgress) : t('friends.refreshingShort')}
      </p>
    );
  }
  if (linkedOpen(friends).length === 0) return null;
  return <p className="mb-3 text-xs text-gray-500">🔄 {asOf ? t('friends.asOf', { when: formatWhen(asOf) }) : t('friends.neverSynced')}</p>;
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
