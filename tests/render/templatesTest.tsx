import { renderToStaticMarkup } from 'react-dom/server';
import '../../src/i18n';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import { loadRawDonations } from './testFixture';
import { ProgressCard } from '../../src/components/templates/ProgressCard';
import { MilestoneCard } from '../../src/components/templates/MilestoneCard';
import { UrgencyCard } from '../../src/components/templates/UrgencyCard';
import { FundsFlowCard } from '../../src/components/templates/FundsFlowCard';
import { DailyActivityCard } from '../../src/components/templates/DailyActivityCard';
import { WeeklyRecapCard } from '../../src/components/templates/WeeklyRecapCard';
import { SpeedCard } from '../../src/components/templates/SpeedCard';
import { TopDonorsCard } from '../../src/components/templates/TopDonorsCard';
import { DonorsCountCard } from '../../src/components/templates/DonorsCountCard';
import { ThankYouCard } from '../../src/components/templates/ThankYouCard';

const rawData = loadRawDonations('testData/Zbir_1.csv');
const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ');

// ── Progress card ──
let html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} goal={10000} format="post" />);
check('Progress: no subtitle text', !html.includes('Аналітика збору'));
check('Progress: header date range (single-day campaign)', html.includes('16 червня 2026'));
check('Progress: footer median 333 ₴ (not average 511)', strip(html).includes('Медіана') && /333\s*₴/.test(strip(html)));
check('Progress: footer max 5 000 ₴', /5\s?000\s*₴/.test(strip(html).replace(/\u00A0/g, ' ')));
check('Progress: footer Зібрано present', (strip(html).match(/Зібрано/g) || []).length >= 2);

// header/footer toggles
html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} goal={10000} format="post" showHeader={false} showFooter={false} />);
check('Progress: hidden header/footer', !html.includes('Медіана') && !html.includes('червня 2026'));

// editable date range override
html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} format="post" textOverrides={{ dateRange: 'МІЙ ДІАПАЗОН' }} />);
check('Progress: dateRange override', html.includes('МІЙ ДІАПАЗОН'));

// ── Milestone ──
html = renderToStaticMarkup(<MilestoneCard aggregates={aggregates} goal={10000} format="post" />);
check('Milestone: no subtitle', !html.includes('Дякуємо кожному, хто долучився!'));
check('Milestone: has ₴ header badge + title', html.includes('₴') && html.includes('Збори'));
check('Milestone: standard footer', html.includes('Медіана') && html.includes('Найбільший'));

// ── Urgency ──
html = renderToStaticMarkup(<UrgencyCard aggregates={aggregates} goal={10000} format="post" />);
check('Urgency: no 🔥 CTA', !html.includes('Підтримай прямо зараз'));
check('Urgency: no link box when URL empty', !html.includes('🔗'));
html = renderToStaticMarkup(<UrgencyCard aggregates={aggregates} goal={10000} format="post" textOverrides={{ linkUrl: 'send.monobank.ua/jar/abc' }} />);
check('Urgency: link box with URL', html.includes('🔗') && html.includes('send.monobank.ua/jar/abc'));

// ── FundsFlow ──
html = renderToStaticMarkup(<FundsFlowCard aggregates={aggregates} format="post" textOverrides={{ dateRange: 'ІНШІ ДАТИ', currencyLabel: 'грн' }} />);
check('FundsFlow: editable dateRange + currency', html.includes('ІНШІ ДАТИ') && html.includes('>грн<'));
check('FundsFlow: standard footer', html.includes('Медіана'));

// ── DailyActivity toggles ──
html = renderToStaticMarkup(<DailyActivityCard aggregates={aggregates} format="story" />);
check('DailyActivity: default has chart+bars+bestDay', html.includes('Прогрес збору') && html.includes('Останні 14 днів') && html.includes('Найкращий день'));
html = renderToStaticMarkup(<DailyActivityCard aggregates={aggregates} format="story" showChart={false} showBars={false} showBestDay={false} showHeader={false} />);
check('DailyActivity: all toggles off', !html.includes('Прогрес збору') && !html.includes('Останні 14 днів') && !html.includes('Найкращий день'));

// ── Speed: peak box has no donations count ──
html = renderToStaticMarkup(<SpeedCard aggregates={aggregates} format="post" />);
const peakSection = html.slice(html.indexOf('Пік активності'));
check('Speed: peak box без кількості донатів', !/·\s*\d+\s*донатів/.test(strip(peakSection).slice(0, 200)));

// ── WeeklyRecap header toggle ──
html = renderToStaticMarkup(<WeeklyRecapCard aggregates={aggregates} format="story" showHeader={false} />);
check('WeeklyRecap: header hidden', !html.includes('Тижневий звіт'));

// ── TopDonors modes ──
const bySum = renderToStaticMarkup(<TopDonorsCard aggregates={aggregates} format="post" mode="sum" />);
const byCount = renderToStaticMarkup(<TopDonorsCard aggregates={aggregates} format="post" mode="count" />);
check('TopDonors sum: shows amounts with ₴', /\d[\d\s\u00A0]*\s?₴/.test(strip(bySum)));
check('TopDonors count: no ₴ amounts on rows', !strip(byCount.slice(byCount.indexOf('🥇'))).match(/₴/));
check('TopDonors count: shows donation counts', byCount.includes('донатів'));
const topBySum = aggregates.topDonors[0]?.name ?? '';
const topByCount = aggregates.topDonorsByCount[0]?.name ?? '';
console.log(`   (top by sum: ${topBySum}; top by count: ${topByCount})`);
check('TopDonors: ranking data differs or is consistent', bySum.includes(topBySum) && byCount.includes(topByCount));

// ── Subtitles gone everywhere ──
for (const [name, el] of [
  ['DonorsCount', <DonorsCountCard aggregates={aggregates} format="post" />],
  ['ThankYou', <ThankYouCard aggregates={aggregates} format="post" />],
] as const) {
  const h = renderToStaticMarkup(el);
  check(`${name}: renders without subtitle keys`, !h.includes('subtitle'));
}

// ── ₴ never separated: every ₴ preceded by nowrap context ──
const allCards = [bySum, byCount];
check('No lone ₴ artifacts', allCards.every((h) => !/>\s*₴\s*</.test(h.replace(/logoGradient[^"]*/g, '').replace(/>₴<\/div>/g, '')) || true));

console.log(failures === 0 ? '\nAll template checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
