/** What was typed into a goal field as an amount; null when empty or not a positive number. */
export function parseGoal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(/[\s,.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
