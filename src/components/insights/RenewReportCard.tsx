import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { RenewAll } from '../../hooks/useRenewAll';
import { WarningIcon, XIcon } from '../../icons';

const NAMES_SHOWN = 3;

/** What a renew did to the helper jars. The part that needs the user is the jars it could not touch:
 * they were typed in by hand, so their amounts are as old as the last edit. */
export function RenewReportCard({ renew }: { renew: RenewAll }) {
  const { t } = useTranslation('insights');
  const { dispatch } = useAppContext();
  const { report } = renew;
  if (!report) return null;
  const { jarsUpdated, jarsFailed, rateLimited, manual } = report;
  if (jarsUpdated === 0 && jarsFailed === 0 && manual.length === 0) return null;
  const names = manual.slice(0, NAMES_SHOWN).map((f) => f.name || '—').join(', ');
  const more = manual.length - NAMES_SHOWN;

  return (
    <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 animate-fade-in" role="status">
      <div className="flex items-start gap-2">
        {manual.length > 0 && <WarningIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />}
        <div className="flex-1 min-w-0 space-y-1">
          {manual.length > 0 && (
            <>
              <p className="font-semibold">{t('renew.manualTitle', { count: manual.length })}</p>
              <p>
                {names}
                {more > 0 && ` ${t('renew.manualMore', { count: more })}`}
              </p>
              <button onClick={() => dispatch({ type: 'FRIENDS_EDIT_OPENED' })} className="font-semibold underline">
                {t('renew.manualEdit')}
              </button>
            </>
          )}
          {jarsFailed > 0 && (
            <p>{rateLimited ? t('friends.refreshRateLimited', { updated: jarsUpdated }) : t('friends.refreshFailed', { updated: jarsUpdated, failed: jarsFailed })}</p>
          )}
          {jarsFailed === 0 && jarsUpdated > 0 && <p className="text-xs text-amber-800">{t('renew.jarsUpdated', { count: jarsUpdated })}</p>}
        </div>
        <button onClick={renew.dismissReport} aria-label={t('renew.dismiss')} className="-m-1 p-1 text-amber-600 hover:text-amber-900">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
