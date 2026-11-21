import { existsSync, readFileSync } from 'node:fs';
import { CARD_FONTS, FONT_SUBSETS, fontById, fontFromFamily, fontStack, DEFAULT_FONT_ID } from '../../src/utils/cardFonts';

const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) process.exitCode = 1;
};

// every file a font declares is shipped (the export embeds exactly these)
const missing: string[] = [];
for (const f of CARD_FONTS) {
  for (const s of FONT_SUBSETS.filter((x) => f.subsets.includes(x.name))) {
    for (const w of f.weights ?? [null]) {
      const file = `public/fonts/${w === null ? `${f.id}-${s.name}` : `${f.id}-${w}-${s.name}`}.woff2`;
      if (!existsSync(file)) missing.push(file);
    }
  }
}
check('every declared font file exists', missing.length === 0, missing.join(', '));

// every non-default font has a @font-face for each of its subsets in index.css, and a weight range
const css = readFileSync('src/index.css', 'utf8');
for (const f of CARD_FONTS.filter((x) => x.id !== DEFAULT_FONT_ID)) {
  const faces = css.split('@font-face').filter((b) => b.includes(`font-family: '${f.family}'`));
  check(`${f.label}: one @font-face per subset`, faces.length === f.subsets.length, `${faces.length} vs ${f.subsets.length}`);
  check(`${f.label}: weight range matches`, faces.every((b) => b.includes(`font-weight: ${f.range}`)));
}

check('unknown / missing id falls back to Inter', fontById('nope').id === 'inter' && fontById(null).id === 'inter' && fontById(undefined).id === 'inter');
check('stack: Inter stays first for Inter', fontStack('inter').startsWith("'Inter'"));
check('stack: chosen font first, Inter behind it for glyphs it lacks (₴)', fontStack('playfair').startsWith("'Playfair Display', 'Inter'"));
check('family read back from computed style', fontFromFamily(`"Playfair Display", Inter, sans-serif`).id === 'playfair' && fontFromFamily(fontStack('caveat')).id === 'caveat');
check('an unknown family reads as Inter', fontFromFamily('Arial, sans-serif').id === 'inter');
check('ids are unique', new Set(CARD_FONTS.map((f) => f.id)).size === CARD_FONTS.length);
