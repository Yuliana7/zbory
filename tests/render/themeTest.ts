import { currentTheme, otherTheme, savedTheme } from '../../src/utils/theme';

const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) process.exitCode = 1;
};

check('the toggle flips light ↔ dark', otherTheme('light') === 'dark' && otherTheme('dark') === 'light');

// outside a browser (no localStorage / matchMedia): nothing picked, the device unknown → light
check('no storage: nothing saved', savedTheme() === null);
check('no storage, no device hint: light', currentTheme() === 'light');

// a stored pick is read back and beats the device; anything else means "not picked"
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Pick<Storage, 'getItem'> }).localStorage = { getItem: (k) => store[k] ?? null };
store['zbory-theme'] = 'dark';
check('stored dark is read', savedTheme() === 'dark' && currentTheme() === 'dark');
store['zbory-theme'] = 'light';
check('stored light is read', savedTheme() === 'light' && currentTheme() === 'light');
store['zbory-theme'] = 'purple';
check('an unknown stored value means not picked', savedTheme() === null);
