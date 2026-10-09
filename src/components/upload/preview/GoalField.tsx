import { useTranslation } from 'react-i18next';

interface GoalFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** the typed text isn't a usable amount */
  invalid: boolean;
}

/** The goal amount input, shared by the preview's collapsible section and the focused goal screen. */
export function GoalField({ value, onChange, invalid }: GoalFieldProps) {
  const { t } = useTranslation('upload');
  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">{t('preview.goal.hint')}</p>
      <div className="relative max-w-xs">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('preview.goal.placeholder')}
          aria-label={t('preview.goal.label')}
          // text-base (16px): anything smaller makes iOS zoom the page on focus
          className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                     placeholder:text-gray-400"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">₴</span>
      </div>
      {invalid && <p className="mt-1 text-xs text-red-500">{t('preview.goal.invalidNumber')}</p>}
    </div>
  );
}
