import { toPng } from 'html-to-image';

// Self-hosted Inter subsets (see src/index.css). At export time they're
// inlined as data: URLs so the offscreen SVG rasterizer renders the same
// font as the live preview. We hand html-to-image ready-made CSS via
// `fontEmbedCSS`, which also bypasses its crash-prone font auto-detection
// (the reason `skipFonts: true` was used before).
const FONT_WEIGHTS = [400, 600, 700, 800] as const;
const FONT_SUBSETS: Array<{ name: string; unicodeRange: string }> = [
  {
    name: 'cyrillic-ext', // includes U+20B4 — the ₴ sign
    unicodeRange: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  },
  {
    name: 'cyrillic',
    unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  },
  {
    name: 'latin',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
];

let cachedFontCSS: string | null = null;

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

async function getFontEmbedCSS(): Promise<string> {
  if (cachedFontCSS !== null) return cachedFontCSS;
  const faces = await Promise.all(
    FONT_WEIGHTS.flatMap((weight) =>
      FONT_SUBSETS.map(async ({ name, unicodeRange }) => {
        // BASE_URL matters: the app deploys under a subpath (vite base '/zbory/')
        const dataUrl = await fetchAsDataUrl(`${import.meta.env.BASE_URL}fonts/inter-${weight}-${name}.woff2`);
        return `@font-face { font-family: 'Inter'; font-style: normal; font-weight: ${weight}; src: url('${dataUrl}') format('woff2'); unicode-range: ${unicodeRange}; }`;
      }),
    ),
  );
  cachedFontCSS = faces.join('\n');
  return cachedFontCSS;
}

export async function renderToPNGDataUrl(
  element: HTMLElement,
  width: number,
  height: number
): Promise<string> {
  let fontEmbedCSS = '';
  try {
    fontEmbedCSS = await getFontEmbedCSS();
  } catch (err) {
    // Fonts are a rendering nicety — export with system fallback rather than fail
    console.error('Font embedding failed, exporting with fallback font:', err);
  }

  return toPng(element, {
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
