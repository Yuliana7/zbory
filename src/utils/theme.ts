// Light or dark. Until the user picks one, the device decides (and is followed live); a pick is kept on
// this device. `.dark` on <html> is what the styles react to (index.html applies it before the first
// paint, so there is no light flash).

export type Theme = 'light' | 'dark';

const KEY = 'zbory-theme';
const query = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

/** The theme the user picked on this device, if they did. */
export function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** The theme in effect: the pick, else the device's. */
export const currentTheme = (): Theme => savedTheme() ?? (query()?.matches ? 'dark' : 'light');

export function applyTheme() {
  document.documentElement.classList.toggle('dark', currentTheme() === 'dark');
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode: the pick just lasts until the page closes
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Until a pick is made, follow the device when it switches (sunset, a manual change). Returns the unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  const q = query();
  if (!q) return () => undefined;
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}

export const otherTheme = (t: Theme): Theme => (t === 'dark' ? 'light' : 'dark');
