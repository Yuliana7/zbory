import { toPng } from 'html-to-image';

export async function exportToPNG(
  element: HTMLElement,
  filename: string,
  width: number,
  height: number
): Promise<void> {
  // skipFonts avoids a crash in html-to-image's font embedder when CSS font
  // properties are undefined. Templates use system fonts so this is safe.
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 1,
    width,
    height,
    skipFonts: true,
    style: {
      transform: 'none',
      transformOrigin: 'top left',
    },
  });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
