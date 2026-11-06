import { useTranslation } from 'react-i18next';
import type { Aggregates } from '../../types';
import { useAppContext } from '../../context/AppContext';
import type { RenewAll } from '../../hooks/useRenewAll';
import { REQUEST_GAP_SECONDS } from '../../utils/monobankApi';
import { formatWhen } from '../../utils/friendsRefresh';
import { RefreshIcon, SpinnerIcon } from '../../icons';
import { CountdownRing } from '../upload/CountdownRing';

interface TotalRaisedCardProps {
  aggregates: Aggregates;
  duration: number;
  renew: RenewAll;
}

/** The headline total and the page's one renew button: it brings the main jar and the helper jars up to date together. */
export function TotalRaisedCard({ aggregates, duration, renew }: TotalRaisedCardProps) {
  const { t } = useTranslation('insights');
  const { t: tUpload } = useTranslation('upload');
  const { state } = useAppContext();
  const { app } = state;
  const waiting = renew.statementProgress?.waitSeconds ?? 0;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-indigo-200 text-sm font-medium">{t('totalAmount')}</p>
        {renew.available && (
          <button
            onClick={renew.running ? renew.stop : renew.renew}
            title={t('friends.refreshHint')}
            className="-mt-1 shrink-0 flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {renew.running ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
            {renew.running ? t('renew.stop') : t('renew.button')}
          </button>
        )}
      </div>
      <p className="text-4xl font-bold tracking-tight">
        {new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.currentBalance + aggregates.totalWithdrawn))} ₴
      </p>
      <p className="mt-2 text-indigo-200 text-sm">
        {t('donationsCount', { count: aggregates.donationCount })} {t('duration', { count: duration })} 💙💛
      </p>

      {(renew.mainLinked || renew.running) && (
        <div className="mt-3 pt-3 border-t border-white/15 text-xs text-indigo-100" aria-live="polite">
          {renew.running ? (
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
              {renew.hasToken && (
                <button onClick={renew.forget} className="underline text-indigo-200 hover:text-white">
                  {t('renew.forget')}
                </button>
              )}
            </div>
          )}
          {!renew.running && renew.error && renew.error !== 'invalid-token' && (
            <p role="alert" className="mt-1 font-medium text-amber-200">{tUpload(`monobank.errors.${renew.error}`)}</p>
          )}
        </div>
      )}
    </div>
  );
}
