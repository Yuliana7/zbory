import { useTranslation } from 'react-i18next';
import { dayOf } from '../../utils/archive';

/** «Дата закриття» when a jar goes into the archive: its last donation by default (the year and month it
 * is filed under), changeable, never in the future. */
export function ClosedOnField({ value, onChange, min, disabled }: { value: string; onChange: (day: string) => void; min?: string; disabled?: boolean }) {
  const { t } = useTranslation('archive');
  return (
    <label className="block rounded-xl bg-gray-50 px-3.5 py-3">
      <span className="flex items-center justify-between gap-3 text-sm text-gray-800">
        {t('closedOn.label')}
        <input
          type="date"
          value={value}
          min={min}
          max={dayOf(Date.now())}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-40 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </span>
      <span className="mt-1 block text-xs text-gray-500">{t('closedOn.hint')}</span>
    </label>
  );
}
