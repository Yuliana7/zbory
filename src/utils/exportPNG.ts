import { toPng } from 'html-to-image';

export async function renderToPNGDataUrl(
  element: HTMLElement,
  width: number,
  height: number
): Promise<string> {
  // skipFonts avoids a crash in html-to-image's font embedder when CSS font
  // properties are undefined. Templates use system fonts so this is safe.
  return toPng(element, {
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
}

export async function exportToPNG(
  element: HTMLElement,
  filename: string,
  width: number,
  height: number
): Promise<void> {
  const dataUrl = await renderToPNGDataUrl(element, width, height);
  downloadDataUrl(dataUrl, filename);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
