import type { TemplateType } from '../types';

export interface TextFieldDef {
  key: string;
  multiline?: boolean;
}

export const TEMPLATE_TEXT_FIELDS: Record<TemplateType, TextFieldDef[]> = {
  progress: [
    { key: 'title' },
    { key: 'subtitle' },
    { key: 'collectedLabel' },
    { key: 'currencyLabel' },
    { key: 'goalLabel' },
    { key: 'statDonations' },
    { key: 'statAverage' },
    { key: 'statMax' },
  ],
  'daily-activity': [
    { key: 'title' },
    { key: 'subtitle' },
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
    { key: 'subtitle' },
    { key: 'achievedLabel' },
    { key: 'collectedLabel' },
    { key: 'goalLabel' },
    { key: 'donationsLabel' },
  ],
  'top-donors': [
    { key: 'title' },
    { key: 'subtitle' },
    { key: 'anonymousLabel' },
    { key: 'donationsLabel' },
    { key: 'totalDonorsLabel' },
  ],
  'donors-count': [
    { key: 'title' },
    { key: 'subtitle' },
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
    { key: 'subtitle' },
    { key: 'remainingLabel' },
    { key: 'callToAction' },
    { key: 'collectedLabel' },
    { key: 'goalLabel' },
  ],
  'weekly-recap': [
    { key: 'title' },
    { key: 'subtitle' },
    { key: 'thisWeekLabel' },
    { key: 'prevWeekLabel' },
    { key: 'bestDayLabel' },
    { key: 'donationsLabel' },
  ],
  speed: [
    { key: 'title' },
    { key: 'subtitle' },
    { key: 'totalLabel' },
    { key: 'donationsLabel' },
    { key: 'peakLabel' },
    { key: 'hourlyLabel' },
  ],
  'funds-flow': [
    { key: 'title' },
    { key: 'subtitle' },
    { key: 'raisedLabel' },
    { key: 'spentLabel' },
    { key: 'balanceLabel' },
    { key: 'refundsLabel' },
    { key: 'donationsLabel' },
    { key: 'noWithdrawalsNote' },
  ],
};

export const TEMPLATE_SUPPORTS_DATE_RANGE: Record<TemplateType, boolean> = {
  progress: true,
  'daily-activity': true,
  'thank-you': false,
  milestone: true,
  'top-donors': true,
  'donors-count': true,
  urgency: true,
  'weekly-recap': true,
  speed: true,
  'funds-flow': false, // always shows the full campaign picture
};

export const TEMPLATE_REQUIRES_GOAL: Record<TemplateType, boolean> = {
  progress: false,
  'daily-activity': false,
  'thank-you': false,
  milestone: true,
  'top-donors': false,
  'donors-count': false,
  urgency: true,
  'weekly-recap': false,
  speed: false,
  'funds-flow': false,
};

export const TEMPLATE_DEFAULT_FORMAT: Record<TemplateType, 'post' | 'story'> = {
  progress: 'post',
  'daily-activity': 'story',
  'thank-you': 'post',
  milestone: 'post',
  'top-donors': 'story',
  'donors-count': 'post',
  urgency: 'post',
  'weekly-recap': 'story',
  speed: 'post',
  'funds-flow': 'post',
};
