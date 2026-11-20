import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnJar } from '../../types';
import { fmtUah } from '../../utils/friendJars';
import { goalPct } from '../../utils/ownJars';
import { GoalReachedQuestion } from './GoalReachedQuestion';

/** «В архів» for one of the user's friendly jars: with no goal set, whether it reached its goal must be
 * said first (for «Цілей досягнуто» in «Мій рік»); with one, the numbers say it. */
export function OwnJarArchiveSheet({ jar, onConfirm, onCancel }: { jar: OwnJar; onConfirm: (goalReached: boolean | undefined) => void; onCancel: () => void }) {
  const { t } = useTranslation('archive');
  const [reached, setReached] = useState<boolean | undefined>(undefined);
  const pct = goalPct(jar.raised, jar.target);
  const needsAnswer = pct === null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="screen-overlay z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in text-left"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="own-archive-title"
        className="sheet-panel w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="own-archive-title" className="text-lg font-bold text-gray-900 [overflow-wrap:anywhere]">
            {t('ownArchive.title', { name: jar.name || '—' })}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{t('ownArchive.text', { year: new Date().getFullYear() })}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3.5 py-3 text-sm">
          {needsAnswer ? (
            <>
              <p className="mb-2 text-gray-700">{t('ownArchive.raised', { amount: fmtUah(jar.raised) })}</p>
              <GoalReachedQuestion value={reached} onChange={setReached} />
            </>
          ) : (
            <p className="text-gray-700">
              {t('ownArchive.byGoal', { amount: fmtUah(jar.raised), goal: fmtUah(jar.target!), pct })}{' '}
              <span className={`font-semibold ${pct >= 100 ? 'text-green-700' : 'text-gray-900'}`}>{pct >= 100 ? t('ownArchive.reached') : t('ownArchive.notReached')}</span>
            </p>
          )}
        </div>
        {needsAnswer && reached === undefined && <p className="text-xs text-gray-500">{t('goalQuestion.required')}</p>}
        <div className="flex flex-col gap-2">
          <button onClick={() => onConfirm(needsAnswer ? reached : undefined)} disabled={needsAnswer && reached === undefined} className="btn-primary disabled:opacity-50">
            {t('ownArchive.confirm')}
          </button>
          <button onClick={onCancel} className="btn-secondary">
            {t('close.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
