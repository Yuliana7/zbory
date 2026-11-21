// Light / dark / follow the device. The choice is kept on this device; `.dark` on <html> is what the
// styles react to (index.html applies it before the first paint, so there is no light flash).

export type ThemePreference = 'auto' | 'light' | 'dark';

const KEY = 'zbory-theme';
const query = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export const isDark = (pref: ThemePreference) => (pref === 'auto' ? !!query()?.matches : pref === 'dark');

export function applyTheme(pref: ThemePreference) {
  document.documentElement.classList.toggle('dark', isDark(pref));
}

export function saveThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // private mode: the choice just lasts until the page closes
  }
  applyTheme(pref);
}

/** In «auto», follow the device when it switches (sunset, a manual change). Returns the unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  const q = query();
  if (!q) return () => undefined;
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}

export const nextThemePreference = (p: ThemePreference): ThemePreference => (p === 'auto' ? 'light' : p === 'light' ? 'dark' : 'auto');
