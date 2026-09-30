import type { SharedStyle } from '../types';
import { generateId } from './id';
import { getBackend } from './db';

// Named, reusable style presets — independent of any one campaign, so a
// look built once can be applied to others. Always created fresh (never
// updated in place): editing a theme later must never retroactively change
// a campaign that already applied it (snapshot semantics), so there is
// deliberately no "update this theme" path here.

const THEME_STORE = 'themes';

export interface ThemeRecord {
  id: string;
  name: string;
  style: SharedStyle;
  createdAt: number;
  updatedAt: number;
}

export interface SaveThemeInput {
  name: string;
  style: SharedStyle;
}

export async function saveTheme(input: SaveThemeInput): Promise<ThemeRecord> {
  const id = generateId();
  const now = Date.now();
  const theme: ThemeRecord = {
    id,
    name: input.name.trim(),
    // Stamped to its own id so the stored style is self-consistent —
    // applying this theme later carries the correct themeId with it.
    style: { ...input.style, themeId: id },
    createdAt: now,
    updatedAt: now,
  };
  await getBackend().put(THEME_STORE, theme);
  return theme;
}

/** All saved themes, most recently updated first. */
export async function listThemes(): Promise<ThemeRecord[]> {
  const all = (await getBackend().getAll(THEME_STORE)) as ThemeRecord[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteTheme(id: string): Promise<void> {
  await getBackend().remove(THEME_STORE, id);
}
