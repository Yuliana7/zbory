/** Helpers for YYYY-MM-DD date ranges. ISO dates compare correctly as plain strings. */

/** iOS Safari ignores `min`/`max` on date inputs and lets any day be picked, so DateField
 * enforces them with this: a day outside the limits snaps to the nearest allowed one. */
export function clampDate(value: string, min?: string, max?: string): string {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

/** A range saved backwards (possible before DateField enforced its limits on iOS) is read
 * the right way round instead of matching nothing. */
export function orderedRange(from: string, to: string): [string, string] {
  return from && to && from > to ? [to, from] : [from, to];
}
