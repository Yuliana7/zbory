import type { TemplateType } from '../types';

export interface TextFieldDef {
  key: string;
  multiline?: boolean;
}

// Standard footer fields for Progress-category templates:
// Зібрано / Типовий донат (median) / Найбільший
const FOOTER_FIELDS: TextFieldDef[] = [
  { key: 'statCollected' },
  { key: 'statMedian' },
  { key: 'statMax' },
];

export const TEMPLATE_TEXT_FIELDS: Record<TemplateType, TextFieldDef[]> = {
  progress: [
    { key: 'title' },
    { key: 'dateRange' },
    { key: 'collectedLabel' },
    { key: 'currencyLabel' },
    { key: 'goalLabel' },
    ...FOOTER_FIELDS,
  ],
  'daily-activity': [
    { key: 'title' },
    { key: 'totalLabel' },
    { key: 'chartLabel' },
    { key: 'barsLabel' },
    { key: 'bestDayLabel' },
    { key: 'statDonations' },
    { key: 'statAverage' },
  ],
  'thank-you': [
    { key: 'title' },
    { key: 'amountLabel' },
    { key: 'message', multiline: true },
    { key: 'donorsLabel' },
    { key: 'branding' },
  ],
  milestone: [
    { key: 'title' },
    { key: 'achievedLabel' },
    { key: 'collectedLabel' },
    { key: 'goalLabel' },
    ...FOOTER_FIELDS,
  ],
  'top-donors': [
    { key: 'title' },
    { key: 'donationsLabel' },
    { key: 'totalDonorsLabel' },
  ],
  'top-donors-count': [
    { key: 'title' },
    { key: 'donationsLabel' },
    { key: 'totalDonorsLabel' },
  ],
  'donors-count': [
    { key: 'title' },
    { key: 'donorsLabel' },
    { key: 'anonymousLabel' },
    { key: 'avgLabel' },
    { key: 'maxLabel' },
    { key: 'totalLabel' },
    { key: 'smallLabel' },
    { key: 'mediumLabel' },
    { key: 'largeLabel' },
  ],
  urgency: [
    { key: 'title' },
    { key: 'remainingLabel' },
    { key: 'currencyLabel' },
    { key: 'linkUrl' },
    { key: 'collectedLabel' },
    { key: 'goalLabel' },
    ...FOOTER_FIELDS,
  ],
  'weekly-recap': [
    { key: 'title' },
    { key: 'thisWeekLabel' },
    { key: 'prevWeekLabel' },
    { key: 'bestDayLabel' },
    { key: 'donationsLabel' },
  ],
  speed: [
    { key: 'title' },
    { key: 'totalLabel' },
    { key: 'donationsLabel' },
    { key: 'peakLabel' },
    { key: 'hourlyLabel' },
  ],
  'funds-flow': [
    { key: 'title' },
    { key: 'dateRange' },
    { key: 'raisedLabel' },
    { key: 'currencyLabel' },
    { key: 'spentLabel' },
    { key: 'balanceLabel' },
    { key: 'refundsLabel' },
    { key: 'noWithdrawalsNote' },
    ...FOOTER_FIELDS,
  ],
  'final-report': [
    { key: 'title' },
    { key: 'currencyLabel' },
    { key: 'daysLabel' },
    { key: 'donationsLabel' },
    { key: 'bestDayLabel' },
    { key: 'spentLabel' },
    { key: 'balanceLabel' },
    { key: 'message', multiline: true },
    ...FOOTER_FIELDS,
  ],
  'concrete-ask': [
    { key: 'title' },
    { key: 'remainingLabel' },
    { key: 'unitAmount' },
    { key: 'donationsWord' },
    { key: 'closingLine' },
    { key: 'linkUrl' },
    ...FOOTER_FIELDS,
  ],
  'emoji-cloud': [
    { key: 'title' },
    { key: 'fromCommentsLabel' },
  ],
  comments: [
    { key: 'title' },
  ],
  // Multi-campaign templates (visible only with 2+ statements loaded)
  report: [
    { key: 'title' },
    { key: 'campaigns' },
    { key: 'donations' },
    { key: 'donors' },
    { key: 'topTitle' },
    { key: 'thanks', multiline: true },
  ],
  'campaigns-chart': [
    { key: 'title' },
  ],
};

export const TEMPLATE_SUPPORTS_DATE_RANGE: Record<TemplateType, boolean> = {
  progress: true,
  'daily-activity': true,
  'thank-you': false,
  milestone: true,
  'top-donors': true,
  'top-donors-count': true,
  'donors-count': true,
  urgency: true,
  'weekly-recap': true,
  speed: true,
  'funds-flow': false, // always shows the full campaign picture
  'final-report': false, // final report covers the whole campaign
  'concrete-ask': true,
  'emoji-cloud': false, // comment analysis runs on the full dataset
  comments: false,
  report: false,
  'campaigns-chart': false,
};

export const TEMPLATE_REQUIRES_GOAL: Record<TemplateType, boolean> = {
  progress: false,
  'daily-activity': false,
  'thank-you': false,
  milestone: true,
  'top-donors': false,
  'top-donors-count': false,
  'donors-count': false,
  urgency: true,
  'weekly-recap': false,
  speed: false,
  'funds-flow': false,
  'final-report': false,
  'concrete-ask': true,
  'emoji-cloud': false,
  comments: false,
  report: false,
  'campaigns-chart': false,
};

// Stories are the primary sharing format for volunteers — every template
// opens as 9:16; the post 1:1 variant stays one click away in the editor.
export const TEMPLATE_DEFAULT_FORMAT: Record<TemplateType, 'post' | 'story'> = {
  progress: 'story',
  'daily-activity': 'story',
  'thank-you': 'story',
  milestone: 'story',
  'top-donors': 'story',
  'top-donors-count': 'story',
  'donors-count': 'story',
  urgency: 'story',
  'weekly-recap': 'story',
  speed: 'story',
  'funds-flow': 'story',
  'final-report': 'story',
  'concrete-ask': 'story',
  'emoji-cloud': 'story',
  comments: 'story',
  report: 'story',
  'campaigns-chart': 'story',
};

// Elements the tap-to-remove editor can hide, per template. `id` matches the
// data-element="id" attribute in the card markup and is also the key stored
// in CardState.hiddenElements. `storyOnly` hides the entry itself in post
// format (the element doesn't render there at all, e.g. Daily Activity's
// bars chart).
export interface RemovableElement {
  id: string;
  labelKey: string;
  storyOnly?: boolean;
}

const GLOW: RemovableElement = { id: 'glow', labelKey: 'layout.glow' };
const HEADER: RemovableElement = { id: 'header', labelKey: 'layout.header' };
const FOOTER: RemovableElement = { id: 'footer', labelKey: 'layout.footer' };
const UA_FLAG: RemovableElement = { id: 'uaflag', labelKey: 'layout.UAFlag' };
const el = (id: string, labelKey: string, storyOnly?: boolean): RemovableElement => ({ id, labelKey, storyOnly });

export const TEMPLATE_REMOVABLE_ELEMENTS: Record<TemplateType, RemovableElement[]> = {
  progress: [
    HEADER,
    el('hero', 'layout.hero'),
    el('progressBar', 'layout.progressBar'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'daily-activity': [
    HEADER,
    el('total', 'layout.total'),
    el('chart', 'layout.chart'),
    el('bars', 'layout.bars', true),
    el('bestDay', 'layout.bestDay'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'thank-you': [
    el('decorations', 'layout.decorations'),
    el('emojiLine', 'layout.emojiLine'),
    el('title', 'layout.title'),
    el('hero', 'layout.hero'),
    el('message', 'layout.message'),
    el('donorPill', 'layout.donorPill'),
    el('branding', 'layout.branding'),
    UA_FLAG,
    GLOW,
  ],
  milestone: [
    HEADER,
    el('hero', 'layout.hero'),
    el('achievedLabel', 'layout.achievedLabel'),
    el('progressBar', 'layout.progressBar'),
    el('collectedGoalLine', 'layout.collectedGoalLine'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'donors-count': [
    HEADER,
    el('hero', 'layout.hero'),
    el('anonymousLine', 'layout.anonymousLine'),
    el('statsRow', 'layout.statsRow'),
    el('distribution', 'layout.distribution'),
    UA_FLAG,
    GLOW,
  ],
  urgency: [
    HEADER,
    el('hero', 'layout.hero'),
    el('progressBar', 'layout.progressBar'),
    el('linkBox', 'layout.linkBox'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'top-donors': [HEADER, el('list', 'layout.list'), FOOTER, UA_FLAG, GLOW],
  'top-donors-count': [HEADER, el('list', 'layout.list'), FOOTER, UA_FLAG, GLOW],
  'weekly-recap': [
    HEADER,
    el('weekTotal', 'layout.weekTotal'),
    el('chart', 'layout.chart'),
    el('bestDay', 'layout.bestDay'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  speed: [
    HEADER,
    el('statsRow', 'layout.statsRow'),
    el('hourly', 'layout.hourly'),
    el('peak', 'layout.peak'),
    el('footer', 'layout.footer', true),
    UA_FLAG,
    GLOW,
  ],
  'funds-flow': [
    HEADER,
    el('hero', 'layout.hero'),
    el('flowBar', 'layout.flowBar'),
    el('breakdown', 'layout.breakdown'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'final-report': [
    HEADER,
    el('hero', 'layout.hero'),
    el('statsGrid', 'layout.statsGrid'),
    el('fundsFlowLine', 'layout.fundsFlowLine'),
    el('thankYouMessage', 'layout.thankYouMessage'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'concrete-ask': [
    HEADER,
    el('hero', 'layout.hero'),
    el('progressBar', 'layout.progressBar'),
    el('linkBox', 'layout.linkBox'),
    FOOTER,
    UA_FLAG,
    GLOW,
  ],
  'emoji-cloud': [
    el('title', 'layout.title'),
    el('cloud', 'layout.cloud'),
    el('sourceLine', 'layout.sourceLine'),
    UA_FLAG,
    GLOW,
  ],
  comments: [el('title', 'layout.title'), el('quotes', 'layout.quotes'), UA_FLAG, GLOW],
  report: [
    HEADER,
    el('report-hero', 'layout.reportHero'),
    el('report-stats', 'layout.reportStats'),
    el('report-top', 'layout.reportTop'),
    el('thanksLine', 'layout.thanksLine'),
    UA_FLAG,
    GLOW,
  ],
  'campaigns-chart': [
    HEADER,
    el('chart', 'layout.chart'),
    el('legend', 'layout.legend'),
    UA_FLAG,
    GLOW,
  ],
};

// Gallery categories — also used by the editor's "add template" picker
export interface TemplateGroup {
  id: string;
  labelKey: string; // key in the gallery namespace
  icon: string;
  ids: TemplateType[];
}

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  { id: 'progress', labelKey: 'groups.progress', icon: '📊', ids: ['progress', 'milestone', 'urgency', 'concrete-ask', 'funds-flow', 'final-report'] },
  { id: 'activity', labelKey: 'groups.activity', icon: '📈', ids: ['daily-activity', 'weekly-recap', 'speed'] },
  { id: 'people',   labelKey: 'groups.people',   icon: '🫂', ids: ['thank-you', 'donors-count', 'top-donors', 'top-donors-count', 'emoji-cloud', 'comments'] },
  { id: 'reports',  labelKey: 'groups.reports',  icon: '🗓️', ids: ['report', 'campaigns-chart'] },
];
