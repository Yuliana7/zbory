import type { Aggregates, Insight } from '../types';
import {
  formatCurrency,
  formatUkrainianDate,
  getDayOfWeek,
  findBestDay,
  findPeakHour,
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
    type: 'insight',
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
      type: 'insight',
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
    type: 'insight',
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
    type: 'insight',
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
    type: 'insight',
  };
}

export function generateActionableInsights(aggregates: Aggregates, t: TFn, goal?: number): Insight[] {
  const actions: Insight[] = [];

  const peakHour = findPeakHour(aggregates);
  if (peakHour) {
    const now = new Date();
    const isStillToday = now.getHours() < peakHour.hour;
    const descKey = isStillToday ? 'generated.actionBestTimeDesc_today' : 'generated.actionBestTimeDesc_daily';
    actions.push({
      icon: '⏰',
      title: t('generated.actionBestTimeTitle'),
      value: `${peakHour.hour}:00–${peakHour.hour + 1}:00`,
      description: t(descKey, {
        hour: peakHour.hour,
        hourEnd: peakHour.hour + 1,
        count: peakHour.count,
        total: aggregates.donationCount,
        pct: Math.round((peakHour.count / aggregates.donationCount) * 100),
      }),
      type: 'action',
    });
  }

  const momentumInsight = buildMomentumInsight(aggregates, t);
  if (momentumInsight) actions.push(momentumInsight);

  if (goal && aggregates.totalAmount < goal) {
    const forecast = estimateDaysToGoal(aggregates, goal);
    if (forecast !== null) {
      const eta = new Date();
      eta.setDate(eta.getDate() + forecast.days);
      actions.push({
        icon: '🎯',
        title: t('generated.actionGoalTitle'),
        value: t('generated.actionGoalValue', { count: forecast.days }),
        description: t('generated.actionGoalDesc', {
          remaining: formatCurrency(Math.round(forecast.remaining)),
          rate: formatCurrency(Math.round(forecast.dailyRate)),
          date: formatUkrainianDate(eta),
        }),
        type: 'action',
      });
    }
  }

  const total = aggregates.donationCount;
  const smallPct = (aggregates.smallDonations / total) * 100;
  if (smallPct > 60) {
    actions.push({
      icon: '💸',
      title: t('generated.actionTipTitle'),
      value: t('generated.actionTipValue', { pct: Math.round(smallPct) }),
      description: t('generated.actionTipDesc', { count: aggregates.smallDonations, total }),
      type: 'action',
    });
  }

  return actions;
}

// Compares the last day against the average of up to 7 preceding days —
// a single-day-to-single-day comparison was too noisy to act on.
function buildMomentumInsight(aggregates: Aggregates, t: TFn): Insight | null {
  const sortedDates = [...aggregates.byDate.keys()].sort();
  if (sortedDates.length < 2) return null;

  const lastDate = sortedDates[sortedDates.length - 1];
  const lastAmount = aggregates.byDate.get(lastDate)!.amount;

  const prevDates = sortedDates.slice(Math.max(0, sortedDates.length - 8), -1);
  const prevAvg =
    prevDates.reduce((sum, d) => sum + aggregates.byDate.get(d)!.amount, 0) / prevDates.length;

  if (prevAvg === 0) return null;
  const changePct = Math.round(((lastAmount - prevAvg) / prevAvg) * 100);

  // `count` drives the i18next plural form (1 previous day vs an average of N)
  const proof = {
    last: formatCurrency(Math.round(lastAmount)),
    avg: formatCurrency(Math.round(prevAvg)),
    days: prevDates.length,
    count: prevDates.length,
  };

  if (changePct <= -20) {
    return {
      icon: '🐢',
      title: t('generated.momentumDownTitle'),
      value: t('generated.momentumDownValue', { pct: Math.abs(changePct), count: prevDates.length }),
      description: t('generated.momentumDownDesc', proof),
      type: 'action',
    };
  }

  if (changePct >= 20) {
    return {
      icon: '🚀',
      title: t('generated.momentumUpTitle'),
      value: t('generated.momentumUpValue', { pct: changePct, count: prevDates.length }),
      description: t('generated.momentumUpDesc', proof),
      type: 'action',
    };
  }

  return null;
}

function estimateDaysToGoal(
  aggregates: Aggregates,
  goal: number,
): { days: number; dailyRate: number; remaining: number } | null {
  const { cumulative, totalAmount } = aggregates;
  if (cumulative.length < 3) return null;

  const windowSize = Math.min(7, cumulative.length);
  const recent = cumulative.slice(-windowSize);
  const firstEntry = recent[0];
  const lastEntry = recent[recent.length - 1];

  const startDate = new Date(firstEntry.date);
  const endDate = new Date(lastEntry.date);
  const daysDiff = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const amountGain = lastEntry.total - firstEntry.total;

  if (amountGain <= 0) return null;

  const dailyRate = amountGain / daysDiff;
  const remaining = goal - totalAmount;
  return { days: Math.ceil(remaining / dailyRate), dailyRate, remaining };
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
