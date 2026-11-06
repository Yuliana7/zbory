import { useTranslation } from 'react-i18next';

/** The opt-in for keeping the Monobank token on this device. */
export function RememberToken({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  const { t } = useTranslation('upload');
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-indigo-600" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{t('monobank.remember')}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{t('monobank.rememberHint')}</span>
      </span>
    </label>
  );
}
