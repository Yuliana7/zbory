let counter = 0;

/**
 * Generates a unique-enough id for React keys. Avoids crypto.randomUUID(),
 * which throws on non-HTTPS origins (e.g. plain http:// on a LAN IP).
 */
export function generateId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}
