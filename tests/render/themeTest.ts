import { nextThemePreference, readThemePreference, isDark, type ThemePreference } from '../../src/utils/theme';

const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) process.exitCode = 1;
};

// the toggle goes Auto → Light → Dark → Auto
let p: ThemePreference = 'auto';
const seen = [p];
for (let i = 0; i < 3; i++) seen.push((p = nextThemePreference(p)));
check('toggle cycles auto → light → dark → auto', seen.join() === 'auto,light,dark,auto');

// outside a browser (no localStorage / matchMedia) it falls back to following the device, light
check('no storage: preference is auto', readThemePreference() === 'auto');
check('explicit choices ignore the device', isDark('dark') === true && isDark('light') === false);
check('auto without matchMedia is light', isDark('auto') === false);

// a stored choice is read back; anything else means auto
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Pick<Storage, 'getItem'> }).localStorage = { getItem: (k) => store[k] ?? null };
store['zbory-theme'] = 'dark';
check('stored dark is read', readThemePreference() === 'dark');
store['zbory-theme'] = 'light';
check('stored light is read', readThemePreference() === 'light');
store['zbory-theme'] = 'purple';
check('an unknown stored value means auto', readThemePreference() === 'auto');
