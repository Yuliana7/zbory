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
import { DonationStatsCard } from '../../src/components/templates/DonationStatsCard';
import { ArchiveJourneyCard } from '../../src/components/templates/ArchiveJourneyCard';
import { ArchiveSupportersCard } from '../../src/components/templates/ArchiveSupportersCard';
import { ArchiveNumbersCard } from '../../src/components/templates/ArchiveNumbersCard';
import { ArchiveYearCard } from '../../src/components/templates/ArchiveYearCard';
import type { YearRecap } from '../../src/types';
import { groupsFor, offeredFor, SUMMARY_GROUP, YEAR_GROUP } from '../../src/utils/templateConfig';

const rawData = loadRawDonations('tests/data/Zbir_short.csv');
const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ');

// ── Donation stats card ──
{
  const stats = renderToStaticMarkup(<DonationStatsCard aggregates={aggregates} format="story" />);
  const text = strip(stats).replace(/\u00A0/g, ' ');
  check('Stats: median, mode, mean, largest, smallest', text.includes('Типовий донат') && text.includes('Найчастіший') && text.includes('Середній') && text.includes('Найбільший') && text.includes('Найменший'));
  check('Stats: the middle half', text.includes('Половина всіх донатів') && !text.includes('{{'));
  const shares = [...text.matchAll(/(\d+)\s*%/g)].map((m) => Number(m[1]));
  check('Stats: size shares add up', shares.length === 3 && Math.abs(shares.reduce((a2, b) => a2 + b, 0) - 100) <= 1, shares.join());
  const none = renderToStaticMarkup(<DonationStatsCard aggregates={aggregates} format="post" hidden={new Set(['stats', 'range', 'sizes'])} />);
  check('Stats: parts can be removed', !none.includes('Найчастіший') && !none.includes('Половина') && !none.includes('За сумою'));
}

// ── Progress card ──
let html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} goal={10000} format="post" />);
check('Progress: no subtitle text', !html.includes('Аналітика збору'));
check('Progress: header date range (single-day campaign)', html.includes('12 травня 2026'));
check('Progress: footer median 200 ₴ (not average 320)', strip(html).includes('Медіана') && /200\s*₴/.test(strip(html)));
check('Progress: footer max 1 000 ₴', /1\s?000\s*₴/.test(strip(html).replace(/\u00A0/g, ' ')));
check('Progress: footer Зібрано present', (strip(html).match(/Зібрано/g) || []).length >= 2);

// header/footer toggles
html = renderToStaticMarkup(<ProgressCard aggregates={aggregates} goal={10000} format="post" hidden={new Set(['header', 'footer'])} />);
check('Progress: hidden header/footer', !html.includes('Медіана') && !html.includes('травня 2026'));

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
html = renderToStaticMarkup(<DailyActivityCard aggregates={aggregates} format="story" hidden={new Set(['chart', 'bars', 'bestDay', 'header'])} />);
check('DailyActivity: all toggles off', !html.includes('Прогрес збору') && !html.includes('Останні 14 днів') && !html.includes('Найкращий день'));

// ── Speed: peak box has no donations count ──
html = renderToStaticMarkup(<SpeedCard aggregates={aggregates} format="post" />);
const peakSection = html.slice(html.indexOf('Пік активності'));
check('Speed: peak box без кількості донатів', !/·\s*\d+\s*донатів/.test(strip(peakSection).slice(0, 200)));

// ── WeeklyRecap header toggle ──
html = renderToStaticMarkup(<WeeklyRecapCard aggregates={aggregates} format="story" hidden={new Set(['header'])} />);
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

// ── «Підсумок»: a closed project's cards ──
{
  const long = normalizeDonations(loadRawDonations('tests/data/Zbir_long.csv'));
  const agg = aggregateDonations(long.donations, long.withdrawals, long.currentBalance);
  const text = (h: string) => strip(h).replace(/\u00A0/g, ' ');

  const journey = text(renderToStaticMarkup(<ArchiveJourneyCard aggregates={agg} goal={25000} format="story" />));
  check('Journey: goal, percent and the four quarters', journey.includes('Ціль') && journey.includes('108%') && ['25%', '50%', '75%', '100%'].every((q) => journey.includes(q)) && journey.includes('41-й день'), journey.slice(0, 300));
  const noGoal = text(renderToStaticMarkup(<ArchiveJourneyCard aggregates={agg} format="post" />));
  check('Journey: no goal → quarters of the final total, no goal line', !noGoal.includes('Ціль') && noGoal.includes('гривень зібрано') && noGoal.includes('100%'));
  check('Journey: chart and milestones can be removed', !renderToStaticMarkup(<ArchiveJourneyCard aggregates={agg} goal={25000} hidden={new Set(['chart', 'milestones'])} />).match(/<svg|Коли зібрали/));

  const sup = text(renderToStaticMarkup(<ArchiveSupportersCard aggregates={agg} donations={long.donations} format="story" />));
  check('Supporters: donors, returning share, size bands, top names', sup.includes('людей підтримали збір') && sup.includes('поверталися знову') && sup.includes('78%') && sup.includes('94%') && sup.includes('Марина Тищенко'), sup.slice(0, 400));
  check('Supporters: an empty size band is left out', !sup.includes('понад 1 000 ₴'));
  const noNames = renderToStaticMarkup(<ArchiveSupportersCard aggregates={agg} donations={long.donations} hidden={new Set(['top'])} />);
  check('Supporters: names can be hidden', !noNames.includes('Марина Тищенко') && !noNames.includes('Найбільше задонатили'));

  const story = text(renderToStaticMarkup(<ArchiveNumbersCard aggregates={agg} donations={long.donations} format="story" />));
  const post = text(renderToStaticMarkup(<ArchiveNumbersCard aggregates={agg} donations={long.donations} format="post" />));
  check('Numbers: six tiles in a story, the record day and the run of days', story.includes('рекордний день') && story.includes('3 020 ₴') && story.includes('днів поспіль із донатами'));
  check('Numbers: four tiles in a square post', post.includes('рекордний день') && !post.includes('типовий донат') && !post.includes('днів поспіль'));

  check('Modes: «Підсумок» leads a closed project’s gallery', groupsFor('archive')[0].id === SUMMARY_GROUP);
  check('Modes: its cards aren’t repeated in the other groups', groupsFor('archive').slice(1).every((g) => !g.ids.includes('final-report') && !g.ids.includes('archive-journey')));
  check('Modes: the summary cards are for closed projects only', offeredFor('archive-journey', 'archive') && !offeredFor('archive-journey', 'project') && !offeredFor('archive-numbers', 'ownJar'));
  const recap: YearRecap = {
    year: 2026, total: 451000, count: 3, donations: 4510, friendJars: 18,
    byMonth: [1000, 0, 0, 0, 0, 0, 0, 150000, 0, 300000, 0, 0],
    biggest: { name: 'На авто для евакуації', total: 300000 }, goals: { set: 2, reached: 1 },
  };
  const year = text(renderToStaticMarkup(<ArchiveYearCard recap={recap} aggregates={agg} format="story" />));
  check('Year: its title, total, projects, donors and friendly jars', year.includes('Мій 2026') && year.includes('451 000 ₴') && year.includes('зборів') && year.includes('22') && year.includes('дружніх банок'), year.slice(0, 300));
  check('Year: the busiest month, the biggest project, goals reached', year.includes('жовтень') && year.includes('На авто для евакуації') && year.includes('1 / 2'));
  check('Year: thanks in a story, not in a square post', year.includes('Дякую кожному') && !text(renderToStaticMarkup(<ArchiveYearCard recap={recap} format="post" />)).includes('Дякую кожному'));
  const quiet = text(renderToStaticMarkup(<ArchiveYearCard recap={{ ...recap, friendJars: 0, goals: { set: 0, reached: 0 } }} format="story" />));
  check('Year: no friendly jars, no goals → those are left out', !quiet.includes('дружніх банок') && !quiet.includes('Цілей досягнуто'));
  check('Modes: a year leads with its own card, and gets no single-project wrap-ups', groupsFor('year')[0].id === YEAR_GROUP && offeredFor('archive-year', 'year') && !offeredFor('final-report', 'year') && !offeredFor('archive-journey', 'year') && offeredFor('report', 'year'));
  check('Modes: the year card is for a year only', !offeredFor('archive-year', 'archive') && !offeredFor('archive-year', 'project'));
  check('Modes: a closed project gets no calls to give', !offeredFor('urgency', 'archive') && !offeredFor('concrete-ask', 'archive') && offeredFor('thank-you', 'archive'));
}

console.log(failures === 0 ? '\nAll template checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
