import { saveTheme, listThemes, deleteTheme } from '../../src/utils/themeStore';
import { DEFAULT_SHARED_STYLE } from '../../src/utils/exportStack';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

(async () => {
  // ── create: style is stamped with the theme's own id ──
  const style = { ...DEFAULT_SHARED_STYLE, bgRotate: 45 };
  const created = await saveTheme({ name: '  Синя хвиля  ', style });
  assertEq('create: name trimmed', created.name, 'Синя хвиля');
  assertEq('create: createdAt = updatedAt', created.createdAt, created.updatedAt);
  assertEq('create: stored style carries its own themeId', created.style.themeId, created.id);
  assertEq('create: other style fields preserved', created.style.bgRotate, 45);

  await new Promise((r) => setTimeout(r, 5)); // distinct updatedAt so list order is deterministic
  const second = await saveTheme({ name: 'Осінь', style: DEFAULT_SHARED_STYLE });
  assertEq('create: second theme has its own id', second.id !== created.id, true);

  // ── list: most recently updated first ──
  let list = await listThemes();
  assertEq('list: two themes', list.length, 2);
  assertEq('list: newest first', list[0].id, second.id);

  // ── themes are never updated in place: saving again under the same name makes a new record ──
  const again = await saveTheme({ name: 'Синя хвиля', style });
  assertEq('save again: distinct id (no update-in-place)', again.id !== created.id, true);
  list = await listThemes();
  assertEq('save again: three themes now', list.length, 3);

  // ── delete ──
  await deleteTheme(created.id);
  list = await listThemes();
  assertEq('delete: gone from list', list.some((th) => th.id === created.id), false);
  assertEq('delete: unrelated themes unaffected', list.length, 2);
})();
