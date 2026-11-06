import { readdirSync, readFileSync } from 'node:fs';
import i18n from '../../src/i18n';
import { formatCompact, formatDuration, formatList } from '../../src/utils/intlFormat';
import { toDateInput } from '../../src/utils/exportStack';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

// ── every string with a count goes through the plural rules ──
const dir = 'src/i18n/locales/uk';
const problems: string[] = [];
for (const file of readdirSync(dir)) {
  const flat = new Map<string, string>();
  const walk = (o: Record<string, unknown>, pre: string) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') flat.set(pre + k, v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v as Record<string, unknown>, `${pre}${k}.`);
    }
  };
  walk(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')), '');
  const bases = new Map<string, Set<string>>();
  for (const key of flat.keys()) {
    const m = key.match(/^(.+)_(one|few|many|other)$/);
    if (m) bases.set(m[1], (bases.get(m[1]) ?? new Set()).add(m[2]));
  }
  for (const [base, forms] of bases) if (forms.size !== 4) problems.push(`${file}: ${base} has ${[...forms].join()}`);
  for (const [key, text] of flat) {
    if (!/_(one|few|many|other)$/.test(key) && /\{\{count\}\}\s+[а-яіїєґ]/i.test(text)) problems.push(`${file}: ${key} has one fixed form`);
  }
}
check('every counted string has all four forms', problems.length === 0, problems.join('; '));

const t = i18n.getFixedT('uk');
check('forms follow the number, not the digits', [1, 2, 5, 11, 21, 22, 25].map((count) => t('dateRange.filtered', { ns: 'export', count })).join() === 'Показано 1 донат,Показано 2 донати,Показано 5 донатів,Показано 11 донатів,Показано 21 донат,Показано 22 донати,Показано 25 донатів');
check('the case a sentence needs', t('generated.thankYou.default', { ns: 'insights', count: 21 }).includes('із 21 донату') && t('generated.thankYou.default', { ns: 'insights', count: 22 }).includes('із 22 донатів'));
check('a verb that agrees', t('generated.thankYou.fiftyThousand', { ns: 'insights', count: 21, amount: 'x' }).includes('21 донат допоміг'));
check('a whole phrase that agrees', t('merge.suspectedOverlap', { ns: 'upload', count: 1 }).includes('1 нова операція потрапила') && t('merge.suspectedOverlap', { ns: 'upload', count: 3 }).includes('3 нові операції потрапили'));

// ── Intl wording ──
const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');
check('compact sums', plain(formatCompact(170000)) === '170 тис.' && plain(formatCompact(1200000)) === '1,2 млн' && plain(formatCompact(500)) === '500', formatCompact(170000));
check('durations agree with their number', plain(formatDuration(180)) === '3 години' && plain(formatDuration(90)) === '1 година 30 хвилин' && plain(formatDuration(-21)) === '21 хвилина', formatDuration(90));
check('lists', formatList(['А', 'Б', 'В']) === 'А, Б і В' && formatList(['А']) === 'А');

// ── date inputs ──
check('a date input follows the user\'s clock', toDateInput(new Date(2026, 2, 15, 1, 0)) === '2026-03-15' && toDateInput(new Date(2026, 2, 15, 23, 30)) === '2026-03-15');

console.log(failures === 0 ? '\nAll plural checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
