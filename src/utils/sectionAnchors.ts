// The preview step is a page of sections (#preview, #goal, #friends, #add-data). The URL hash names
// the section to show, so the «Змінити» menu can take you straight to one and the section chips can
// jump between them. There is no router — the hash is the only thing involved, and it is written with
// replaceState so browsing around the sections does not pile up history entries.

export const SECTION_IDS = ['preview', 'goal', 'friends', 'add-data'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Put a section in the URL, to be scrolled to once the preview is on screen. */
export function setSectionHash(id: SectionId): void {
  history.replaceState(null, '', `#${id}`);
}

export function clearSectionHash(): void {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

/** The section named by the URL hash, if any. */
export function currentSection(): SectionId | null {
  const id = location.hash.slice(1);
  return (SECTION_IDS as readonly string[]).includes(id) ? (id as SectionId) : null;
}
