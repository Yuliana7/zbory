import { toPng } from 'html-to-image';

export async function exportToPNG(
  element: HTMLElement,
  filename: string,
  width: number,
  height: number
): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 1,
    width,
    height,
    style: {
      // ensure the element is rendered at full resolution, not the scaled preview
      transform: 'none',
      transformOrigin: 'top left',
    },
  });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
