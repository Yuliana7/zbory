import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import '../../src/i18n';
import i18n from '../../src/i18n';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations, defaultAskUnit } from '../../src/utils/dataAggregator';
import { generateCaption } from '../../src/utils/captionGenerator';
import { detectMoments } from '../../src/utils/momentDetector';
import { generateActionableInsights } from '../../src/utils/insightGenerator';
import { analyzeComments, getPersonalComments } from '../../src/utils/commentAnalyzer';
import { createZip } from '../../src/utils/zip';
import { FinalReportCard } from '../../src/components/templates/FinalReportCard';
import { ConcreteAskCard } from '../../src/components/templates/ConcreteAskCard';
import { EmojiCloudCard } from '../../src/components/templates/EmojiCloudCard';
import { CommentsCard } from '../../src/components/templates/CommentsCard';
import { loadRawDonations } from './testFixture';

const rawData = loadRawDonations('testData/Zbir_1.csv');
const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

// t bound to real i18next instance (all namespaces loaded)
const tExport = i18n.getFixedT('uk', 'export');
const tInsights = i18n.getFixedT('uk', 'insights');

// ── Caption generator ──
const caption = generateCaption('progress', aggregates, tExport, { goal: 20000, linkUrl: 'send.monobank.ua/jar/x' });
console.log('─── Caption (progress, goal 20 000) ───\n' + caption + '\n');
check('caption: no missing i18n', !caption.includes('caption.') && !caption.includes('{{'));
check('caption: has stats + link + hashtags', /11\s?752/.test(caption.replace(/[\u00A0\u202F]/g, ' ')) && caption.includes('🔗') && caption.includes('#збір'));

const askCaption = generateCaption('concrete-ask', aggregates, tExport, { goal: 20000 });
check('caption ask: concrete units', /по\s.*200/.test(askCaption), askCaption);

// ── Concrete ask math: goal 20000, total 11752 → remaining 8248, median 333 → unit 200 → 42 донати ──
check('defaultAskUnit(median 333) = 200', defaultAskUnit(aggregates.medianDonation) === 200);
let html = renderToStaticMarkup(<ConcreteAskCard aggregates={aggregates} goal={20000} format="post" />);
check('ConcreteAsk: 42 донатів по 200 ₴', html.includes('42') && /по.*200\s*₴/.test(html.replace(/<[^>]+>/g, ' ')));
check('ConcreteAsk: remaining 8 248', /8\s?248/.test(html.replace(/ /g, ' ')));
html = renderToStaticMarkup(<ConcreteAskCard aggregates={aggregates} goal={20000} format="post" textOverrides={{ unitAmount: '500' }} />);
check('ConcreteAsk: unit override 500 → 17 донатів', html.includes('>Ще 17 донатів<') || html.replace(/<[^>]+>/g, ' ').includes('Ще 17 донатів'));
html = renderToStaticMarkup(<ConcreteAskCard aggregates={aggregates} goal={5000} format="post" />);
check('ConcreteAsk: goal reached state', html.includes('Мету досягнуто'));
html = renderToStaticMarkup(<ConcreteAskCard aggregates={aggregates} format="post" />);
check('ConcreteAsk: no-goal fallback', html.includes('Підтримай збір') && !html.includes('Ще 0'));

// ── Final report ──
html = renderToStaticMarkup(<FinalReportCard aggregates={aggregates} format="post" />);
const text = html.replace(/<[^>]+>/g, ' ');
check('FinalReport: hero total 11 752', /11\s?752/.test(text.replace(/ /g, ' ')));
check('FinalReport: days + donations + best day', text.includes('Днів') && text.includes('Донатів') && text.includes('Найкращий день'));
check('FinalReport: thank-you message', text.includes('Дякуємо кожному'));
check('FinalReport: standard footer', text.includes('Медіана') || text.includes('Типовий'));

// ── Emoji cloud + comments (synthetic comment-rich data) ──
const richDonations = donations.map((d, i) => ({
  ...d,
  comment: i % 2 === 0 ? `Тримайтесь! 💙💛 №${i}` : '🔥 Все буде Україна!',
}));
const commentInsights = analyzeComments(richDonations);
check('analyzeComments: has emojis', commentInsights.topEmojis.length > 0);
html = renderToStaticMarkup(<EmojiCloudCard aggregates={aggregates} commentInsights={commentInsights} format="post" />);
check('EmojiCloud: renders emojis with counts', html.includes('×') && html.includes('Емоції'));

const personal = getPersonalComments(richDonations);
check('getPersonalComments: deduped', personal.length > 0 && new Set(personal.map(p => p.text)).size === personal.length);

// Auto-comment must be excluded regardless of casing
const withAuto = [
  { ...donations[0], comment: 'Поповнення рахунку Банки' },
  { ...donations[1], comment: 'Поповнення рахунку банки' },
  { ...donations[2], comment: 'Тримайтесь 💙' },
];
const filtered = getPersonalComments(withAuto);
check('auto-comment excluded case-insensitively', filtered.length === 1 && filtered[0].text === 'Тримайтесь 💙');

// Caption for «Слова підтримки» quotes the selection (so ↺ visibly reflects it)
const commentsCaption = generateCaption('comments', aggregates, tExport, {
  comments: [{ text: 'Все буде добре!', donor: 'Яна' }],
});
check('caption comments: includes quoted comment', commentsCaption.includes('«Все буде добре!» — Яна'));
html = renderToStaticMarkup(<CommentsCard aggregates={aggregates} selectedComments={personal.slice(0, 3).map(c => ({ text: c.text, donor: c.donor }))} format="story" />);
check('Comments: renders quotes', html.includes('«') && html.includes('Слова підтримки'));
html = renderToStaticMarkup(<CommentsCard aggregates={aggregates} selectedComments={[]} format="story" />);
check('Comments: empty hint when nothing picked', html.includes('Оберіть коментарі'));

// ── Unique donors vs donations ──
import { DonorsCountCard } from '../../src/components/templates/DonorsCountCard';
{
  // Independent expectation from raw data: distinct names with letters, case-insensitive
  const named = donations.filter((d) => d.donor && /[\p{L}\p{N}]/u.test(d.donor));
  const expectedUnique = new Set(named.map((d) => d.donor!.toLowerCase().trim().replace(/\s+/g, ' '))).size;
  const expectedAnon = donations.length - named.length;
  check(`uniqueDonors = ${expectedUnique} distinct names`, aggregates.uniqueDonors === expectedUnique, `got ${aggregates.uniqueDonors}`);
  check(`anonymousDonations = ${expectedAnon} (🐈 etc.)`, aggregates.anonymousDonations === expectedAnon, `got ${aggregates.anonymousDonations}`);
  check('🐈 excluded from top donors', !aggregates.topDonors.some((d) => d.name === '🐈'));
  const h = renderToStaticMarkup(<DonorsCountCard aggregates={aggregates} format="post" />);
  const ht = h.replace(/<[^>]+>/g, ' ');
  check('DonorsCount: hero shows unique donors', ht.includes(String(expectedUnique)) && ht.includes('людей підтримали збір'));
  check('DonorsCount: anonymous line', expectedAnon === 0 || ht.includes(`+ ${expectedAnon} анонімних донатів`));
}

// ── Safe zone inset: story padding moves header/footer into the safe area ──
html = renderToStaticMarkup(<FinalReportCard aggregates={aggregates} format="story" safeZonePad />);
check('safeZonePad: story gets 270/340 padding', html.includes('padding:270px 80px 340px'));
html = renderToStaticMarkup(<FinalReportCard aggregates={aggregates} format="story" />);
check('safeZonePad off: normal story padding', html.includes('padding:100px 80px'));
html = renderToStaticMarkup(<FinalReportCard aggregates={aggregates} format="post" safeZonePad />);
check('safeZonePad ignored for post format', html.includes('padding:80px'));
html = renderToStaticMarkup(<FinalReportCard aggregates={aggregates} format="post-4-5" safeZonePad />);
check('safeZonePad ignored for post-4-5 format', html.includes('padding:80px'));
check('post-4-5 renders at 1080x1350', html.includes('height:1350px'));

// ── Moments ──
const moments = detectMoments(aggregates, tInsights, 20000);
console.log('─── Moments (goal 20 000) ───');
for (const m of moments) console.log(`  ${m.icon} ${m.text} → ${m.templateId}`);
check('moments: goal 50% detected', moments.some((m) => m.id === 'goal-50'));
check('moments: record day is fresh (single-day campaign, best day = last day) → present', moments.some((m) => m.id === 'record-day'));
check('moments: no missing i18n', moments.every((m) => !m.text.includes('moments.') && !m.text.includes('{{')));

// ── Concrete-ask action insight ──
const actions = generateActionableInsights(aggregates, tInsights, 20000);
const ask = actions.find((a) => a.icon === '🧮');
console.log(`─── Ask insight ───\n  ${ask?.value}\n  ${ask?.description}\n`);
check('ask insight present with 42 units', !!ask && ask.value!.includes('42'));

// ── ZIP writer: build a zip, verify with unzip ──
const zipBlob = createZip([
  { name: 'a.txt', data: new TextEncoder().encode('hello zbory') },
  { name: 'b.txt', data: new TextEncoder().encode('друга файлина') },
]);
zipBlob.arrayBuffer().then((ab: ArrayBuffer) => {
  writeFileSync('tests/render/out-test.zip', Buffer.from(ab));
  console.log('ZIP written, verifying with unzip below…');
  console.log(failures === 0 ? '\nAll improvement checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
});
