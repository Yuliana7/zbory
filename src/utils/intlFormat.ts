// Ukrainian number and list wording, from the browser's Intl. It knows the plural category of a number
// but not grammatical cases: where a sentence needs a particular case, the locale files spell out each
// plural form (_one, _few, _many, _other) and i18next picks one through Intl.PluralRules.

const compact = new Intl.NumberFormat('uk-UA', { notation: 'compact', maximumFractionDigits: 1 });
const hours = new Intl.NumberFormat('uk-UA', { style: 'unit', unit: 'hour', unitDisplay: 'long' });
const minutes = new Intl.NumberFormat('uk-UA', { style: 'unit', unit: 'minute', unitDisplay: 'long' });
const list = new Intl.ListFormat('uk-UA', { type: 'conjunction' });

/** 170000 → "170 тис.", 1200000 → "1,2 млн" */
export const formatCompact = (n: number) => compact.format(n);

/** 180 → "3 години", 90 → "1 година 30 хвилин", -5 → "5 хвилин"; the direction doesn't matter to the reader. */
export function formatDuration(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return [h > 0 ? hours.format(h) : '', m > 0 || h === 0 ? minutes.format(m) : ''].filter(Boolean).join(' ');
}

/** ["А", "Б", "В"] → "А, Б і В" */
export const formatList = (items: string[]) => list.format(items);
