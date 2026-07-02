import type { Aggregates, Insight } from '../types';
import {
  formatCurrency,
  formatUkrainianDate,
  getDayOfWeek,
  findBestDay,
  findPeakHour,
  getCampaignDuration,
} from './dataAggregator';

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

  const humanRange = getDonationRange(aggregates.avgDonation, t);
  insights.push({
    icon: '📊',
    title: t('generated.avgTitle'),
    value: humanRange,
    description: buildAvgDescription(aggregates, t),
    type: 'insight',
  });

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

  const peakHour = findPeakHour(aggregates);
  if (peakHour) {
    insights.push({
      icon: '⏰',
      title: t('generated.peakTitle'),
      value: `${peakHour.hour}:00–${peakHour.hour + 1}:00`,
      description: t('generated.peakDesc', { hour: peakHour.hour }),
      type: 'insight',
    });
  }

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

  const distributionInsight = generateDistributionInsight(aggregates, t);
  if (distributionInsight) insights.push(distributionInsight);

  return insights;
}

function getDonationRange(avg: number, t: TFn): string {
  if (avg < 50)   return t('generated.ranges.lt50');
  if (avg < 100)  return t('generated.ranges.r50_100');
  if (avg < 200)  return t('generated.ranges.r100_200');
  if (avg < 500)  return t('generated.ranges.r200_500');
  if (avg < 1000) return t('generated.ranges.r500_1000');
  if (avg < 5000) return t('generated.ranges.r1000_5000');
  return t('generated.ranges.gt5000');
}

function buildAvgDescription(aggregates: Aggregates, t: TFn): string {
  const { smallDonations, mediumDonations, largeDonations, donationCount } = aggregates;
  const smallPct = Math.round((smallDonations / donationCount) * 100);
  const mediumPct = Math.round((mediumDonations / donationCount) * 100);
  const largePct = Math.round((largeDonations / donationCount) * 100);

  if (smallPct >= 60) return t('generated.avgDesc_small', { pct: smallPct });
  if (largePct >= 30) return t('generated.avgDesc_large', { pct: largePct });
  return t('generated.avgDesc_medium', { pct: mediumPct });
}

function generateDistributionInsight(aggregates: Aggregates, t: TFn): Insight | null {
  const total = aggregates.donationCount;
  const smallPct = Math.round((aggregates.smallDonations / total) * 100);
  const mediumPct = Math.round((aggregates.mediumDonations / total) * 100);
  const largePct = Math.round((aggregates.largeDonations / total) * 100);

  let value: string;
  let description: string;

  if (smallPct > mediumPct && smallPct > largePct) {
    value = t('generated.distribution_small', { pct: smallPct });
    description = t('generated.distribution_small_desc');
  } else if (largePct >= 20) {
    value = t('generated.distribution_large', { pct: largePct });
    description = t('generated.distribution_large_desc', { pct: largePct });
  } else {
    value = t('generated.distribution_medium', { pct: mediumPct });
    description = t('generated.distribution_medium_desc');
  }

  return { icon: '⚖️', title: t('generated.distributionTitle'), value, description, type: 'insight' };
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
      description: t(descKey, { hour: peakHour.hour }),
      type: 'action',
    });
  }

  const momentumInsight = buildMomentumInsight(aggregates, t);
  if (momentumInsight) actions.push(momentumInsight);

  if (goal && aggregates.totalAmount < goal) {
    const daysLeft = estimateDaysToGoal(aggregates, goal);
    if (daysLeft !== null) {
      actions.push({
        icon: '🎯',
        title: t('generated.actionGoalTitle'),
        value: t('generated.actionGoalValue', { count: daysLeft }),
        description: t('generated.actionGoalDesc', { count: daysLeft }),
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
      description: t('generated.actionTipDesc'),
      type: 'action',
    });
  }

  return actions;
}

function buildMomentumInsight(aggregates: Aggregates, t: TFn): Insight | null {
  const sortedDates = [...aggregates.byDate.keys()].sort();
  if (sortedDates.length < 2) return null;

  const lastDate = sortedDates[sortedDates.length - 1];
  const prevDate = sortedDates[sortedDates.length - 2];
  const lastAmount = aggregates.byDate.get(lastDate)!.amount;
  const prevAmount = aggregates.byDate.get(prevDate)!.amount;

  if (prevAmount === 0) return null;
  const changePct = Math.round(((lastAmount - prevAmount) / prevAmount) * 100);

  if (changePct <= -20) {
    return {
      icon: '🐢',
      title: t('generated.momentumDownTitle'),
      value: t('generated.momentumDownValue', { pct: Math.abs(changePct) }),
      description: t('generated.momentumDownDesc'),
      type: 'action',
    };
  }

  if (changePct >= 20) {
    return {
      icon: '🚀',
      title: t('generated.momentumUpTitle'),
      value: t('generated.momentumUpValue', { pct: changePct }),
      description: t('generated.momentumUpDesc'),
      type: 'action',
    };
  }

  return null;
}

function estimateDaysToGoal(aggregates: Aggregates, goal: number): number | null {
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
  return Math.ceil(remaining / dailyRate);
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
