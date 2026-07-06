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
};

export const TEMPLATE_DEFAULT_FORMAT: Record<TemplateType, 'post' | 'story'> = {
  progress: 'post',
  'daily-activity': 'story',
  'thank-you': 'post',
  milestone: 'post',
  'top-donors': 'story',
  'top-donors-count': 'story',
  'donors-count': 'post',
  urgency: 'post',
  'weekly-recap': 'story',
  speed: 'post',
  'funds-flow': 'post',
  'final-report': 'post',
  'concrete-ask': 'post',
  'emoji-cloud': 'post',
  comments: 'story',
};

// Which templates render the standard toggleable header (₴ badge + title)
export const TEMPLATE_HAS_HEADER: Record<TemplateType, boolean> = {
  progress: true,
  'daily-activity': true,
  'thank-you': false,
  milestone: true,
  'top-donors': false,
  'top-donors-count': false,
  'donors-count': false,
  urgency: true,
  'weekly-recap': true,
  speed: true,
  'funds-flow': true,
  'final-report': true,
  'concrete-ask': true,
  'emoji-cloud': false,
  comments: false,
};

// Progress-category templates share the standard toggleable footer
export const TEMPLATE_HAS_FOOTER: Record<TemplateType, boolean> = {
  progress: true,
  'daily-activity': false,
  'thank-you': false,
  milestone: true,
  'top-donors': false,
  'top-donors-count': false,
  'donors-count': false,
  urgency: true,
  'weekly-recap': true,
  speed: true,
  'funds-flow': true,
  'final-report': true,
  'concrete-ask': true,
  'emoji-cloud': false,
  comments: false,
};

// Blocks inside each template that can be exported alone as a transparent PNG
// "sticker". Ids must match the data-sticker attribute in the card markup.
export const TEMPLATE_STICKERS: Record<TemplateType, string[]> = {
  progress: ['hero', 'progressBar'],
  'daily-activity': ['chart', 'bars', 'bestDay'],
  'thank-you': [],
  milestone: ['hero'],
  'top-donors': ['list'],
  'top-donors-count': ['list'],
  'donors-count': ['distribution'],
  urgency: ['hero', 'progressBar'],
  'weekly-recap': ['chart', 'bestDay'],
  speed: ['hourly', 'peak'],
  'funds-flow': ['flowBar', 'breakdown'],
  'final-report': ['statsGrid'],
  'concrete-ask': ['hero'],
  'emoji-cloud': ['cloud'],
  comments: ['quotes'],
};
