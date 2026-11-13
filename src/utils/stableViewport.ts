let probe: HTMLDivElement | null = null;

/** The viewport height with the browser's toolbars showing (CSS `100svh`). Unlike `innerHeight` it stays
 * put while Safari's toolbar collapses and comes back during a scroll, so sizes based on it don't jump
 * mid-scroll; it only changes on rotation or a real window resize. */
export function stableViewportHeight(): number {
  if (typeof CSS === 'undefined' || !CSS.supports('height', '100svh')) return window.innerHeight;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
  }
  return probe.offsetHeight || window.innerHeight;
}
