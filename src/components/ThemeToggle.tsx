import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoonIcon, SunIcon } from '../icons/ThemeIcons';
import { applyTheme, currentTheme, otherTheme, saveTheme, savedTheme, watchSystemTheme, type Theme } from '../utils/theme';

/** Light ↔ dark. The icon shows the theme you are in. */
export function ThemeToggle() {
  const { t } = useTranslation('common');
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // before the first pick, the device switching to or from dark changes the page too
  useEffect(
    () =>
      watchSystemTheme(() => {
        if (savedTheme()) return;
        applyTheme();
        setTheme(currentTheme());
      }),
    [],
  );

  const Icon = theme === 'dark' ? MoonIcon : SunIcon;
  const next = otherTheme(theme);
  return (
    <button
      type="button"
      onClick={() => {
        saveTheme(next);
        setTheme(next);
      }}
      title={t(`theme.${theme}`)}
      aria-label={`${t('theme.label')}: ${t(`theme.${theme}`)}. ${t('theme.next', { next: t(`theme.${next}`) })}`}
      className="flex h-10 w-10 items-center justify-center rounded-full text-indigo-700 hover:bg-indigo-100 transition-colors"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
