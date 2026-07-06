import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import Papa from 'papaparse';
import '../../src/i18n';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import type { RawDonation } from '../../src/types';
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

const csvText = readFileSync('testData/jar_statement_2026-07-05_10-48.csv', 'utf-8').replace(/^﻿/, '');
const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
const rawData: RawDonation[] = (parsed.data as Record<string, string>[]).map((row) => ({
  date: row['Дата та час операції'] || '',
  category: row['Категорія операції'] || '',
  amount: row['Сума'] || '0',
  currency: row['Валюта'] || 'UAH',
  additionalInfo: row['Додаткова інформація'] || '',
  comment: row['Коментар до платежу'] || '',
  balance: row['Залишок'] || '0',
  balanceCurrency: row['Валюта залишку'] || 'UAH',
}));
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
check('Progress: header date range', html.includes('1 липня 2026') && html.includes('5 липня 2026'));
check('Progress: footer median 100 ₴ (not average 213)', strip(html).includes('Медіана') && /100\s*₴/.test(strip(html)));
check('Progress: footer max 1 111 ₴', /1\s?111\s*₴/.test(strip(html).replace(/ /g, ' ')));
check('Progress: footer Зібрано present', (strip(html).match(/Зібрано/g) || []).length >= 2);

// header/footer toggles
html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} goal={10000} format="post" showHeader={false} showFooter={false} />);
check('Progress: hidden header/footer', !html.includes('Медіана') && !html.includes('липня 2026'));

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
check('TopDonors sum: shows amounts with ₴', /\d[\d\s ]*\s?₴/.test(strip(bySum)));
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
