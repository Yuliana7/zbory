/** How far one element's text can be scaled, on top of the card's overall text size. */
export const ELEMENT_SCALE_MIN = 0.5;
export const ELEMENT_SCALE_MAX = 2;
const SNAP = 0.03;

/** A slider value, sticking to 100% so getting back to normal is easy. */
export const snapScale = (value: number) => (Math.abs(value - 1) < SNAP ? 1 : Math.round(value * 100) / 100);

/** A card's scales with one element changed; 100% isn't stored. */
export function withElementScale(scales: Record<string, number> | undefined, id: string, value: number): Record<string, number> {
  const { [id]: _, ...rest } = scales ?? {};
  return value === 1 ? rest : { ...rest, [id]: value };
}

/** Puts each element's scale on the card as --el-scale, which every text size in the templates reads
 * (see utils/units). The templates don't have to know: they only mark their elements with data-element. */
export function applyElementScales(root: HTMLElement | null, scales: Record<string, number> | undefined) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-element]').forEach((node) => {
    const scale = scales?.[node.dataset.element ?? ''];
    if (scale) node.style.setProperty('--el-scale', String(scale));
    else node.style.removeProperty('--el-scale');
  });
}

/** Whether anything on the card reaches past its edges or is cut off inside its own box. */
export function cardOverflows(root: HTMLElement): boolean {
  const edge = root.getBoundingClientRect();
  return [...root.querySelectorAll<HTMLElement>('[data-element]')].some((node) => {
    if (node.dataset.element === 'glow' || node.dataset.element === 'decorations') return false;
    const box = node.getBoundingClientRect();
    return box.bottom > edge.bottom + 1 || box.right > edge.right + 1 || box.top < edge.top - 1 || box.left < edge.left - 1 || node.scrollWidth > node.clientWidth + 1;
  });
}
