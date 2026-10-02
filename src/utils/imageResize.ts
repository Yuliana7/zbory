/** Longest side, in px, kept for an uploaded background. The card is 1080 wide and
 * the editor zooms up to 3x on an image that is first fitted to the card, so this
 * is about 1:1 at maximum zoom — anything beyond only costs memory. */
export const BG_MAX_SIDE = 3000;

/** Size that fits within `maxSide` on the longer side, never upscaling. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Reads an uploaded background image as a data URL, shrinking it first if it is
 * larger than the editor can use. A phone photo is 12–48 megapixels and several MB;
 * as a raw data URL it is slow to render, heavy for iOS Safari to rasterize into
 * the exported PNG, and gets copied into every saved project and theme. Smaller
 * images are passed through untouched (no re-encoding). If anything about the
 * resize fails, the original is used as-is.
 */
export async function readBackgroundImage(file: File, maxSide = BG_MAX_SIDE): Promise<string> {
  try {
    // createImageBitmap applies the photo's EXIF rotation, like an <img> does
    const bitmap = await createImageBitmap(file);
    const target = fitWithin(bitmap.width, bitmap.height, maxSide);
    if (target.width === bitmap.width && target.height === bitmap.height) {
      bitmap.close();
      return await readAsDataUrl(file);
    }
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();
    // PNGs may be logos with transparency — keep their format; photos become JPEG
    return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return readAsDataUrl(file);
  }
}
