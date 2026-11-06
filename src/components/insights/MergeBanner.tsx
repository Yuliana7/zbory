import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { LastMerge } from '../../types';
import { CheckCircleIcon, WarningIcon, XIcon } from '../../icons';

/** 180 → "3 год", 90 → "1 год 30 хв", -5 → "5 хв" (direction doesn't matter to the reader). */
function formatShift(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return [h > 0 ? `${h} год` : '', m > 0 ? `${m} хв` : ''].filter(Boolean).join(' ');
}

/** What the latest update brought. A merge the app itself doubts can be taken back from here. */
export function MergeBanner({ merge }: { merge: LastMerge }) {
  const { t } = useTranslation('upload');
  const { dispatch, handleUndoMerge } = useAppContext();
  const close = () => dispatch({ type: 'MERGE_REPORTED', payload: undefined });
  const nothingNew = merge.added === 0;
  return (
    <div className="mb-4 space-y-2 animate-fade-in">
      <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-start gap-2">
        <CheckCircleIcon className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          {nothingNew ? t('merge.nothingNew') : t('merge.result', { added: merge.added, duplicates: merge.duplicates })}
          {merge.timeShiftMinutes !== null && !nothingNew && (
            <p className="mt-1 text-xs text-green-700">{t('merge.timeShift', { shift: formatShift(merge.timeShiftMinutes) })}</p>
          )}
        </div>
        <button onClick={close} aria-label={t('merge.cancel')} className="-m-1 p-1 text-green-600 hover:text-green-900">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      {merge.suspectedOverlap && (
        <div role="alert" className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900 flex items-start gap-2">
          <WarningIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            {t('merge.suspectedOverlap', { added: merge.added })}
            <button onClick={handleUndoMerge} className="mt-2 block font-semibold underline">
              {t('merge.undo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
