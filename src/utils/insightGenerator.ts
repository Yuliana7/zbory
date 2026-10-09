import type { Aggregates, Insight } from '../types';
import {
  formatCurrency,
  formatUkrainianDate,
  getDayOfWeek,
  findBestDay,
  getCampaignDuration,
  getTimeBuckets,
} from './dataAggregator';
import type { TimeBucketKey } from './dataAggregator';

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function generateInsights(aggregates: Aggregates, t: TFn): Insight[] {
  const insights: Insight[] = [];

  insights.push({
    icon: '💰',
    title: t('generated.totalTitle'),
    value: formatCurrency(aggregates.totalAmount),
    description: t('generated.totalDesc', { count: aggregates.donationCount }),
  });

  insights.push(buildTypicalDonationInsight(aggregates, t));

  const bestDay = findBestDay(aggregates);
  if (bestDay) {
    const bestDate = new Date(bestDay.date);
    const dayName = getDayOfWeek(bestDate);
    insights.push({
      icon: '🔥',
      title: t('generated.bestDayTitle'),
      value: formatUkrainianDate(bestDate),
      description: t('generated.bestDayDesc', { day: dayName, amount: formatCurrency(bestDay.amount) }),
    });
  }

  const timeInsight = buildTimeBucketsInsight(aggregates, t);
  if (timeInsight) insights.push(timeInsight);

  const duration = getCampaignDuration(aggregates);
  insights.push({
    icon: '📅',
    title: t('generated.durationTitle'),
    value: t('duration', { count: duration }),
    description: t('generated.durationDesc', {
      from: formatUkrainianDate(aggregates.firstDate),
      to: formatUkrainianDate(aggregates.lastDate),
    }),
  });

  return insights;
}

/** Rounds an amount to a "nice" human boundary for range descriptions */
function roundNice(v: number): number {
  if (v >= 5000) return Math.round(v / 1000) * 1000;
  if (v >= 1000) return Math.round(v / 500) * 500;
  if (v >= 200) return Math.round(v / 100) * 100;
  if (v >= 50) return Math.round(v / 50) * 50;
  return Math.max(5, Math.round(v / 10) * 10);
}

/**
 * One rich card instead of the old "range + distribution" pair:
 * mode / median / mean breakdown, plus an adaptive "where most donations fall"
 * range (middle 50%, p25–p75) that scales with the campaign instead of the
 * fixed 100–1000 ₴ buckets.
 */
function buildTypicalDonationInsight(aggregates: Aggregates, t: TFn): Insight {
  const mean = aggregates.totalRaised / aggregates.donationCount;
  const median = aggregates.medianDonation;
  const mode = aggregates.modeDonation;

  const lo = roundNice(aggregates.p25Donation);
  const hi = roundNice(aggregates.p75Donation);
  const rangeSentence =
    lo === hi
      ? t('generated.typical.rangeSingle', { amount: formatCurrency(lo) })
      : t('generated.typical.range', { lo: formatCurrency(lo), hi: formatCurrency(hi) });

  // A mean far above the median means a few generous donors pulled it up
  const shapeSentence =
    mean >= median * 1.4
      ? t('generated.typical.generous', {
          median: formatCurrency(Math.round(median)),
          mode: formatCurrency(mode),
          mean: formatCurrency(Math.round(mean)),
        })
      : t('generated.typical.steady', { mean: formatCurrency(Math.round(mean)) });

  return {
    icon: '💰',
    title: t('generated.avgTitle'),
    stats: [
      { icon: '💰', label: t('generated.typical.mode'), value: formatCurrency(mode) },
      { icon: '📊', label: t('generated.typical.median'), value: formatCurrency(Math.round(median)) },
      { icon: '📈', label: t('generated.typical.mean'), value: formatCurrency(Math.round(mean)) },
    ],
    description: `${rangeSentence} ${shapeSentence}`,
  };
}

const TIME_BUCKET_ICONS: Record<TimeBucketKey, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  night: '🌙',
};

function buildTimeBucketsInsight(aggregates: Aggregates, t: TFn): Insight | null {
  const buckets = getTimeBuckets(aggregates).filter((b) => b.count > 0);
  if (buckets.length === 0) return null;

  const top = buckets.reduce((a, b) => (b.count > a.count ? b : a));

  return {
    icon: '⏰',
    title: t('generated.peakTitle'),
    value: t(`generated.timeBuckets.dominant_${top.key}`),
    stats: buckets.map((b) => ({
      icon: TIME_BUCKET_ICONS[b.key],
      label: t(`generated.timeBuckets.${b.key}`),
      value: t('generated.timeBuckets.donations', { count: b.count }),
    })),
  };
}

export function generateThankYouMessage(totalAmount: number, donationCount: number, t: TFn): string {
  if (totalAmount >= 1000000) return t('generated.thankYou.million', { count: donationCount });
  if (totalAmount >= 500000)  return t('generated.thankYou.halfMillion', { count: donationCount });
  if (totalAmount >= 100000)  return t('generated.thankYou.hundredThousand', { count: donationCount });
  if (totalAmount >= 50000)   return t('generated.thankYou.fiftyThousand', { count: donationCount, amount: formatCurrency(totalAmount) });
  return t('generated.thankYou.default', { count: donationCount });
}

export function generateProgressMessage(current: number, t: TFn, goal?: number): string {
  if (!goal) return t('generated.progress.noGoal', { amount: formatCurrency(current) });

  const pct = Math.round((current / goal) * 100);
  if (pct >= 150) return t('generated.progress.fantastic', { pct });
  if (pct >= 100) return t('generated.progress.exceeded', { pct });
  if (pct >= 90)  return t('generated.progress.nearlyDone', { pct });
  if (pct >= 75)  return t('generated.progress.threeQuarters', { pct });
  if (pct >= 50)  return t('generated.progress.halfway', { pct });
  return t('generated.progress.default', { pct });
}
