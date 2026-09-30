const MARGIN = 12;
// Below this width the Export page is single-column and its preview is pinned
// to the top of the screen (xl breakpoint = side-by-side, nothing overlaps).
const SINGLE_COLUMN_MAX = 1280;

/** Scroll a just-focused input into the part of the screen the user can
 * actually see: below the pinned preview and above the on-screen keyboard.
 *
 * `scrollIntoView` can't do this — it centers in the whole window, so the input
 * can land behind the sticky preview, and the preview itself changes height
 * while the page scrolls (it shrinks), which moves the target mid-flight. So
 * we measure, nudge, and re-measure a few times while the keyboard animates. */
export function revealInput(el: HTMLElement) {
  const reveal = () => {
    if (!el.isConnected) return;
    const vv = window.visualViewport;
    const preview =
      window.innerWidth < SINGLE_COLUMN_MAX ? document.querySelector('[data-pinned-preview]') : null;
    const visibleTop = (preview?.getBoundingClientRect().bottom ?? 0) + MARGIN;
    const visibleBottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - MARGIN;
    const rect = el.getBoundingClientRect();
    if (rect.top < visibleTop) window.scrollBy({ top: rect.top - visibleTop });
    else if (rect.bottom > visibleBottom) window.scrollBy({ top: rect.bottom - visibleBottom });
  };
  // Keyboard open animation + the preview's scroll-driven resize settle in ~0.5s.
  [50, 250, 500].forEach((ms) => setTimeout(reveal, ms));
}
