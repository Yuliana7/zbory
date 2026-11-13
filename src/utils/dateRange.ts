/** Helpers for YYYY-MM-DD date ranges. ISO dates compare correctly as plain strings. */

/** iOS Safari ignores `min`/`max` on date inputs and lets any day be picked, so DateField
 * enforces them with this when the picker closes: a day outside the limits snaps to the
 * nearest allowed one. */
export function clampDate(value: string, min?: string, max?: string): string {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

/** A range that is backwards (saved before DateField enforced its limits, or for a moment
 * while a picker is still open) is read the right way round instead of matching nothing. */
export function orderedRange(from: string, to: string): [string, string] {
  return from && to && from > to ? [to, from] : [from, to];
}
