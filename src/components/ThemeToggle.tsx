import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoThemeIcon, MoonIcon, SunIcon } from '../icons/ThemeIcons';
import { applyTheme, nextThemePreference, readThemePreference, saveThemePreference, watchSystemTheme, type ThemePreference } from '../utils/theme';

const ICONS = { auto: AutoThemeIcon, light: SunIcon, dark: MoonIcon } as const;

/** One button that goes Auto → Light → Dark. «Auto» follows the device and its schedule. */
export function ThemeToggle() {
  const { t } = useTranslation('common');
  const [pref, setPref] = useState<ThemePreference>(readThemePreference);

  // while on «auto», the device switching to or from dark changes the page too
  useEffect(() => (pref === 'auto' ? watchSystemTheme(() => applyTheme('auto')) : undefined), [pref]);

  const Icon = ICONS[pref];
  const next = nextThemePreference(pref);
  return (
    <button
      type="button"
      onClick={() => {
        saveThemePreference(next);
        setPref(next);
      }}
      title={t(`theme.${pref}`)}
      aria-label={`${t('theme.label')}: ${t(`theme.${pref}`)}. ${t('theme.next', { next: t(`theme.${next}`) })}`}
      className="flex h-10 w-10 items-center justify-center rounded-full text-indigo-700 hover:bg-indigo-100 transition-colors"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
