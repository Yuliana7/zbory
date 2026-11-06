/** A text size. --el-scale is an element's own scale, set on the element it applies to (see utils/elementScale). */
export const rem = (px: number): string => `calc(${px / 16}rem * var(--el-scale, 1))`;
/**
 * Root padding for a template card. With safeZonePad on (story format), the
 * top/bottom padding grows so header and footer sit inside Instagram's story
 * safe area (~250px top / ~310px bottom of 1920 are covered by the IG UI).
 */
export function cardPadding(
  isStory: boolean,
  safeZonePad: boolean | undefined,
  storyPadding: string,
  horizontal = '80px',
): string {
  if (!isStory) return '80px';
  return safeZonePad ? `270px ${horizontal} 340px` : storyPadding;
}
