import { createContext, useContext } from 'react';

// The fonts a card can be set in. All are self-hosted (public/fonts, SIL Open Font License),
// Cyrillic-capable, and embedded into the PNG at export so the picture matches the preview.

/** Unicode ranges of the three subsets we ship; the same text in every font file name. */
export const FONT_SUBSETS: Array<{ name: 'cyrillic-ext' | 'cyrillic' | 'latin'; unicodeRange: string }> = [
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

export interface CardFont {
  id: string;
  /** shown on the picker, in Ukrainian */
  label: string;
  family: string;
  /** subsets that exist for it (Playfair has no cyrillic-ext; ₴ then comes from the fallback) */
  subsets: Array<(typeof FONT_SUBSETS)[number]['name']>;
  /** Inter ships one file per weight; the others are variable fonts, one file per subset */
  weights: readonly number[] | null;
  /** the weight range written into the @font-face of a variable font */
  range?: string;
  /** @font-face size-adjust, for a font that sets small next to the others (Caveat) */
  sizeAdjust?: string;
}

const ALL = ['cyrillic-ext', 'cyrillic', 'latin'] as const;

export const CARD_FONTS: readonly CardFont[] = [
  { id: 'inter', label: 'Inter', family: 'Inter', subsets: [...ALL], weights: [400, 600, 700, 800] },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', subsets: [...ALL], weights: null, range: '400 800' },
  { id: 'nunito', label: 'Nunito', family: 'Nunito', subsets: [...ALL], weights: null, range: '400 800' },
  { id: 'playfair', label: 'Playfair', family: 'Playfair Display', subsets: ['cyrillic', 'latin'], weights: null, range: '400 800' },
  { id: 'oswald', label: 'Oswald', family: 'Oswald', subsets: [...ALL], weights: null, range: '400 700' },
  { id: 'caveat', label: 'Caveat', family: 'Caveat', subsets: [...ALL], weights: null, range: '400 700', sizeAdjust: '120%' },
];

export const DEFAULT_FONT_ID = 'inter';

export const fontById = (id: string | null | undefined): CardFont => CARD_FONTS.find((f) => f.id === id) ?? CARD_FONTS[0];

/** The CSS stack of a font: Inter and the system sans behind it, for any glyph it lacks. */
export const fontStack = (id: string | null | undefined): string => {
  const { family } = fontById(id);
  return family === 'Inter' ? "'Inter', 'Segoe UI', sans-serif" : `'${family}', 'Inter', 'Segoe UI', sans-serif`;
};

/** Which font a rendered card is set in, read back from its computed font-family. */
export const fontFromFamily = (cssFamily: string): CardFont => {
  const first = cssFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  return CARD_FONTS.find((f) => f.family === first) ?? CARD_FONTS[0];
};

/** The font id of the card being drawn; templates read it through CardShell. */
export const CardFontContext = createContext<string>(DEFAULT_FONT_ID);
export const useCardFont = () => useContext(CardFontContext);
