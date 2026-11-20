import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/** «Чи досягли цілі?» for a jar closed with no goal set: so «Мій рік» can count it among the goals reached.
 * Optional — tapping the chosen answer again takes it back. */
export function GoalReachedQuestion({ value, onChange, disabled }: { value: boolean | undefined; onChange: (v: boolean | undefined) => void; disabled?: boolean }) {
  const { t } = useTranslation('archive');
  const labelId = useId();
  const pill = (on: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'}`;
  return (
    <div className="flex items-center gap-3">
      <span id={labelId} className="flex-1 text-sm text-gray-800">
        {t('goalQuestion.label')}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex w-36 shrink-0 gap-1.5">
        {([true, false] as const).map((v) => (
          <button key={String(v)} role="radio" aria-checked={value === v} disabled={disabled} onClick={() => onChange(value === v ? undefined : v)} className={pill(value === v)}>
            {v ? t('goalQuestion.yes') : t('goalQuestion.no')}
          </button>
        ))}
      </div>
    </div>
  );
}
