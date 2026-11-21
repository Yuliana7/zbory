import { toPng } from 'html-to-image';
import { saveBlob } from './download';
import { DEFAULT_FONT_ID, FONT_SUBSETS, fontById, fontFromFamily, type CardFont } from './cardFonts';

// Self-hosted font subsets (see src/index.css, utils/cardFonts). At export time they're
// inlined as data: URLs so the offscreen SVG rasterizer renders the same
// font as the live preview. We hand html-to-image ready-made CSS via
// `fontEmbedCSS`, which also bypasses its crash-prone font auto-detection
// (the reason `skipFonts: true` was used before).
// Inter is always embedded (the fallback for any glyph the card's font lacks, e.g. ₴),
// plus the font the card is set in.
const fontCSSCache = new Map<string, Promise<string>>();

async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font fetch failed: ${url}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fontFacesCSS(font: CardFont): Promise<string> {
  const cached = fontCSSCache.get(font.id);
  if (cached) return cached;
  const job = Promise.all(
    FONT_SUBSETS.filter((s) => font.subsets.includes(s.name)).flatMap(({ name, unicodeRange }) =>
      // Inter has a file per weight; the others are variable fonts with one file per subset
      (font.weights ?? [null]).map(async (weight) => {
        const file = weight === null ? `${font.id}-${name}` : `${font.id}-${weight}-${name}`;
        // BASE_URL matters: the app deploys under a subpath (vite base '/zbory/')
        const dataUrl = await fetchAsDataUrl(`${import.meta.env.BASE_URL}fonts/${file}.woff2`);
        const w = weight === null ? font.range : weight;
        return `@font-face { font-family: '${font.family}'; font-style: normal; font-weight: ${w}; src: url('${dataUrl}') format('woff2'); unicode-range: ${unicodeRange}; }`;
      }),
    ),
  ).then((faces) => faces.join('\n'));
  // a failed fetch must not stay cached: the next export gets another try
  job.catch(() => fontCSSCache.delete(font.id));
  fontCSSCache.set(font.id, job);
  return job;
}

async function getFontEmbedCSS(card: CardFont): Promise<string> {
  const fonts = card.id === DEFAULT_FONT_ID ? [card] : [fontById(DEFAULT_FONT_ID), card];
  return (await Promise.all(fonts.map(fontFacesCSS))).join('\n');
}

export async function renderToPNGDataUrl(
  element: HTMLElement,
  width: number,
  height: number
): Promise<string> {
  let fontEmbedCSS = '';
  try {
    // the font is read back from the card itself, so every caller exports in the font it shows
    fontEmbedCSS = await getFontEmbedCSS(fontFromFamily(getComputedStyle(element).fontFamily));
  } catch (err) {
    // Fonts are a rendering nicety — export with system fallback rather than fail
    console.error('Font embedding failed, exporting with fallback font:', err);
  }

  const render = () =>
    toPng(element, {
      cacheBust: true,
      pixelRatio: 1,
      width,
      height,
      // Providing fontEmbedCSS makes html-to-image skip its own (crash-prone)
      // font scraping; an empty string keeps that behavior as a safe fallback.
      fontEmbedCSS,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
      },
    });

  // Safari/WebKit (every browser on iOS) rasterizes the exported SVG before an
  // <img> inside it has finished loading, so the FIRST render of a card with a
  // photo comes out without it — just the palette color behind it. A second
  // render finds the image ready. Reproduced in WebKit: first export missing,
  // second present, regardless of image size or the CSS effects on it. Cards
  // without an image don't need the extra pass.
  if (element.querySelector('img')) await render();
  return render();
}

export async function exportToPNG(
  element: HTMLElement,
  filename: string,
  width: number,
  height: number
): Promise<void> {
  const dataUrl = await renderToPNGDataUrl(element, width, height);
  await saveBlob(new Blob([dataUrlToBytes(dataUrl)], { type: 'image/png' }), filename);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
