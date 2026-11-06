import { useLayoutEffect, type RefObject } from 'react';

/** the preview never gets smaller than this share of its size, however far the controls are scrolled */
export const PREVIEW_MIN_SCALE = 0.33;
export const PREVIEW_PAD = 24;
export const PREVIEW_PAD_MIN = 8;

interface Parts {
  /** the pinned box. In the layout it is only as tall as the collapsed preview, or it would run out of
   * room to stay pinned near the end of the page; its contents overflow it. */
  box: RefObject<HTMLElement>;
  /** holds the rest of the full preview's height, so scrolling never moves anything else */
  spacer: RefObject<HTMLElement>;
  /** an empty marker where the box sits before it pins */
  marker: RefObject<HTMLElement>;
  background: RefObject<HTMLElement>;
  card: RefObject<HTMLElement>;
  nav: RefObject<HTMLElement>;
}

/**
 * On a single column the preview gives way to the controls like a reel to its comments: past the point
 * where it pins, it loses exactly what the page scrolled, so the controls rise with the finger.
 *
 * Only transforms and opacity change, and on a current browser the page's scroll position drives them
 * directly (see .preview-collapse in index.css), on the compositor. Nothing here runs per scroll
 * there: re-rendering the card and re-laying out its text on every scroll event was fine on a laptop
 * and janky on an iPhone, where scroll events also arrive after the page has already moved. Older
 * browsers set the same transforms from a scroll listener.
 */
export function useCollapsingPreview({ box, spacer, marker, background, card, nav }: Parts, cardHeight: number, enabled: boolean) {
  useLayoutEffect(() => {
    const boxEl = box.current;
    const spacerEl = spacer.current;
    const markerEl = marker.current;
    const bgEl = background.current;
    const cardEl = card.current;
    const navEl = nav.current;
    if (!enabled || !boxEl || !spacerEl || !markerEl || !bgEl || !cardEl || !navEl) return;

    const scrollDriven = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()') && CSS.supports('animation-range: 10px 20px');
    const cardShift = PREVIEW_PAD_MIN - PREVIEW_PAD;
    let from = 0;
    let shrink = 0;

    const apply = () => {
      const p = shrink > 0 ? Math.min(1, Math.max(0, (window.scrollY - from) / shrink)) : 0;
      bgEl.style.transform = `translateY(${-shrink * p}px)`;
      cardEl.style.transform = `translateY(${cardShift * p}px) scale(${1 - (1 - PREVIEW_MIN_SCALE) * p})`;
      navEl.style.opacity = String(Math.max(0, 1 - p / 0.12));
      navEl.style.visibility = p >= 0.12 ? 'hidden' : '';
    };

    const measure = () => {
      const full = cardHeight + navEl.offsetHeight + 2 * PREVIEW_PAD;
      const collapsed = cardHeight * PREVIEW_MIN_SCALE + 2 * PREVIEW_PAD_MIN;
      shrink = full - collapsed;
      boxEl.style.height = `${collapsed}px`;
      bgEl.style.height = `${full}px`;
      spacerEl.style.height = `${shrink}px`;
      const pinnedAt = parseFloat(getComputedStyle(boxEl).top) || 0;
      from = markerEl.getBoundingClientRect().top + window.scrollY - pinnedAt;
      boxEl.style.setProperty('--collapse-from', `${from}px`);
      boxEl.style.setProperty('--collapse-to', `${from + shrink}px`);
      boxEl.style.setProperty('--collapse-bg', `${-shrink}px`);
      boxEl.style.setProperty('--collapse-card-y', `${cardShift}px`);
      boxEl.style.setProperty('--collapse-scale', String(PREVIEW_MIN_SCALE));
      if (!scrollDriven) apply();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(navEl);
    window.addEventListener('resize', measure);

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    if (!scrollDriven) window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      boxEl.style.height = bgEl.style.height = spacerEl.style.height = '';
      bgEl.style.transform = cardEl.style.transform = '';
      navEl.style.opacity = navEl.style.visibility = '';
    };
  }, [box, spacer, marker, background, card, nav, cardHeight, enabled]);
}
