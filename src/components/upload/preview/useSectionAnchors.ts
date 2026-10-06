import { useCallback, useEffect, useRef } from 'react';
import { currentSection, setSectionHash, type SectionId } from '../../../utils/sectionAnchors';

/** Scrolls to (and briefly highlights) a section. */
function reveal(id: SectionId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('section-flash');
  void el.offsetWidth; // restart the animation if it is already running
  el.classList.add('section-flash');
  el.addEventListener('animationend', () => el.classList.remove('section-flash'), { once: true });
}

/** Makes the preview's URL hash work: on arrival (and whenever the hash changes) the named
 * section is revealed; `goTo` is what the section chips call.
 *
 * The hash is deliberately NOT cleared when this unmounts: the preview also unmounts while the
 * Monobank wizard is on screen (and React's StrictMode fakes an unmount in dev), and coming
 * back should land on the same section. Whoever leaves the preview for good clears it
 * (clearSectionHash), so a later visit doesn't scroll to a stale section. */
export function useSectionAnchors() {
  const arrivedAt = useRef(currentSection());

  useEffect(() => {
    const onHash = () => {
      const id = currentSection();
      if (id) reveal(id);
    };
    const t = setTimeout(() => arrivedAt.current && reveal(arrivedAt.current), 80); // let the page lay out first
    window.addEventListener('hashchange', onHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  return useCallback((id: SectionId) => {
    setSectionHash(id);
    reveal(id);
  }, []);
}
