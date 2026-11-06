import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useFriendsRefresh } from '../../hooks/useFriendsRefresh';
import { useMonobankRenew } from '../../hooks/useMonobankRenew';
import { REQUEST_GAP_SECONDS } from '../../utils/monobankApi';
import { formatWhen, linkedOpen } from '../../utils/friendsRefresh';
import { RefreshIcon, SpinnerIcon } from '../../icons';
import { CountdownRing } from '../upload/CountdownRing';
import { RenewTokenSheet } from './RenewTokenSheet';

interface TotalRaisedCardProps {
  aggregates: Aggregates;
  duration: number;
  /** this view is the whole open project (not one jar of several) */
  wholeProject: boolean;
}

/** The headline total, and the one button that renews everything the project has linked: the helper
 * jars first (they answer at once), then the main jar's statement, which can take a token and a wait. */
export function TotalRaisedCard({ aggregates, duration, wholeProject }: TotalRaisedCardProps) {
  const { t } = useTranslation('insights');
  const { t: tUpload } = useTranslation('upload');
  const { state, dispatch } = useAppContext();
  const { app } = state;
  const renewal = useMonobankRenew();
  const { renew } = renewal;
  const friends = app.friends ?? [];
  const refresh = useFriendsRefresh(friends, { readOnOpen: false }); // the friends block reads on arrival
  const canRenew = wholeProject && !!app.monobankJar && !app.campaignDatasets;
  const linkedJars = wholeProject ? linkedOpen(friends).length : 0;
  const running = renewal.running || refresh.running;
  const stopped = useRef(false);

  const renewAll = async () => {
    stopped.current = false;
    if (linkedJars > 0) await refresh.refreshAll();
    if (canRenew && !stopped.current) renew();
  };
  const stopAll = () => {
    stopped.current = true;
    refresh.stop();
    renewal.stop();
  };

  // «Оновити з Monobank» in the project list lands here and starts right away. In a timer so that
  // StrictMode's trial unmount cancels it instead of sending the rate-limited request twice.
  const requested = !!app.renewRequested;
  useEffect(() => {
    if (!requested) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'RENEW_REQUESTED', payload: false });
      renew();
    }, 0);
    return () => clearTimeout(timer);
  }, [requested, renew, dispatch]);

  const waiting = renewal.progress?.waitSeconds ?? 0;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-indigo-200 text-sm font-medium">{t('totalAmount')}</p>
        {(canRenew || linkedJars > 0) && (
          <button
            onClick={running ? stopAll : renewAll}
            className="-mt-1 shrink-0 flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {running ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
            {running ? t('renew.stop') : t(canRenew && linkedJars > 0 ? 'renew.buttonAll' : 'renew.button')}
          </button>
        )}
      </div>
      <p className="text-4xl font-bold tracking-tight">
        {new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.currentBalance + aggregates.totalWithdrawn))} ₴
      </p>
      <p className="mt-2 text-indigo-200 text-sm">
        {t('donationsCount', { count: aggregates.donationCount })} {t('duration', { count: duration })} 💙💛
      </p>

      {(canRenew || refresh.running) && (
        <div className="mt-3 pt-3 border-t border-white/15 text-xs text-indigo-100" aria-live="polite">
          {refresh.running ? (
            refresh.progress ? t('friends.refreshing', refresh.progress) : t('friends.refreshingShort')
          ) : renewal.running ? (
            waiting > 0 ? (
              <span className="flex items-center gap-2">
                <CountdownRing secondsLeft={waiting} totalSeconds={REQUEST_GAP_SECONDS} className="w-4 h-4 shrink-0" />
                {t('renew.waiting', { seconds: waiting })}
              </span>
            ) : (
              t('renew.running')
            )
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span>
                🔄{' '}
                {app.monobankSyncedAt
                  ? t('renew.syncedAt', { when: formatWhen(app.monobankSyncedAt) })
                  : t('renew.lastDonation', { when: formatWhen(aggregates.lastDate.getTime()) })}
              </span>
              {renewal.hasToken && (
                <button onClick={renewal.forget} className="underline text-indigo-200 hover:text-white">
                  {t('renew.forget')}
                </button>
              )}
            </div>
          )}
          {!renewal.running && renewal.error && renewal.error !== 'invalid-token' && (
            <p role="alert" className="mt-1 font-medium text-amber-200">{tUpload(`monobank.errors.${renewal.error}`)}</p>
          )}
        </div>
      )}

      {renewal.askToken && (
        <RenewTokenSheet
          error={renewal.error === 'invalid-token' ? tUpload('monobank.errors.invalid-token') : null}
          onSubmit={renewal.submitToken}
          onClose={renewal.closeTokenSheet}
        />
      )}
    </div>
  );
}
