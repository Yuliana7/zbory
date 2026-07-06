import type { Aggregates, TemplateType } from '../types';
import { formatCurrency, formatUkrainianDate, getCampaignDuration, findBestDay, defaultAskUnit } from './dataAggregator';

type TFn = (key: string, options?: Record<string, unknown>) => string;

interface CaptionOptions {
  goal?: number;
  linkUrl?: string;
  /** Hand-picked comments — quoted in the caption for the «Слова підтримки» template */
  comments?: Array<{ text: string; donor?: string }>;
}

// Which opening line fits each template
const OPENER_KIND: Record<TemplateType, 'progress' | 'ask' | 'thanks' | 'recap' | 'transparency'> = {
  progress: 'progress',
  milestone: 'progress',
  'final-report': 'thanks',
  urgency: 'ask',
  'concrete-ask': 'ask',
  'thank-you': 'thanks',
  'donors-count': 'thanks',
  'top-donors': 'thanks',
  'top-donors-count': 'thanks',
  'emoji-cloud': 'thanks',
  comments: 'thanks',
  'daily-activity': 'recap',
  'weekly-recap': 'recap',
  speed: 'recap',
  'funds-flow': 'transparency',
};

/**
 * Builds a ready-to-paste Instagram caption for the selected template:
 * opener → key numbers → jar link → hashtags. The user can edit it in the
 * textarea before copying, so this only needs to be a solid starting point.
 */
export function generateCaption(
  templateId: TemplateType,
  aggregates: Aggregates,
  t: TFn,
  { goal, linkUrl, comments }: CaptionOptions = {},
): string {
  const total = aggregates.totalAmount;
  const pct = goal ? Math.round((total / goal) * 100) : null;
  const duration = getCampaignDuration(aggregates) + 1;
  const bestDay = findBestDay(aggregates);

  const kind = OPENER_KIND[templateId];
  let opener: string;
  switch (kind) {
    case 'progress':
      opener =
        pct !== null && pct >= 100
          ? t('caption.opener_goalReached', { pct })
          : pct !== null
            ? t('caption.opener_progress', { pct })
            : t('caption.opener_noGoal', { total: formatCurrency(total) });
      break;
    case 'ask': {
      const remaining = goal ? Math.max(goal - total, 0) : 0;
      if (goal && remaining > 0) {
        const unit = defaultAskUnit(aggregates.medianDonation);
        const n = Math.ceil(remaining / unit);
        opener = t('caption.opener_ask', {
          remaining: formatCurrency(remaining),
          count: n,
          unit: formatCurrency(unit),
        });
      } else {
        opener = t('caption.opener_goalReached', { pct: pct ?? 100 });
      }
      break;
    }
    case 'thanks':
      opener = t('caption.opener_thanks', { count: aggregates.donationCount });
      break;
    case 'recap':
      opener = t('caption.opener_recap');
      break;
    case 'transparency':
      opener = t('caption.opener_transparency');
      break;
  }

  const statLines = [
    goal
      ? t('caption.stat_totalWithGoal', {
          total: formatCurrency(total),
          goal: formatCurrency(goal),
          pct,
        })
      : t('caption.stat_total', { total: formatCurrency(total) }),
    t('caption.stat_donations', { count: aggregates.donationCount, days: duration }),
    ...(bestDay
      ? [
          t('caption.stat_bestDay', {
            date: formatUkrainianDate(new Date(bestDay.date)),
            amount: formatCurrency(bestDay.amount),
          }),
        ]
      : []),
  ];

  const parts = [opener];
  if (templateId === 'comments' && comments?.length) {
    parts.push('', ...comments.map((c) => `«${c.text}»${c.donor ? ` — ${c.donor}` : ''}`));
  }
  parts.push('', ...statLines);
  if (linkUrl?.trim()) parts.push('', `🔗 ${linkUrl.trim()}`);
  parts.push('', t('caption.hashtags'));

  return parts.join('\n');
}
