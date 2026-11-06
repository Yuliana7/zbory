/** Takes back the latest removal this format can show. `hiddenElements` is in the order things were
 * removed, so undo needs no history of its own and keeps working after the editor is reopened. A
 * story-only element hidden earlier is skipped on a post, where undoing it would change nothing. */
export function undoLastHidden(hiddenElements: string[], elements: Array<{ id: string; storyOnly?: boolean }>, format: string): string[] {
  const shown = new Set(elements.filter((e) => !e.storyOnly || format === 'story').map((e) => e.id));
  for (let i = hiddenElements.length - 1; i >= 0; i--) {
    if (shown.has(hiddenElements[i])) return [...hiddenElements.slice(0, i), ...hiddenElements.slice(i + 1)];
  }
  return hiddenElements;
}
