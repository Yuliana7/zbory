import type { Aggregates, TemplateType } from '../types';
import { findBestDay, formatCurrency } from './dataAggregator';

export interface Moment {
  id: string;
  icon: string;
  text: string;
  templateId: TemplateType;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

const GOAL_THRESHOLDS = [100, 75, 50, 25] as const;
const COUNT_THRESHOLDS = [10000, 5000, 2500, 1000, 500, 250, 100];
const TOTAL_THRESHOLDS = [1000000, 500000, 250000, 100000, 50000, 25000, 10000];

/**
 * Scans the data for share-worthy "moments" — crossed goal thresholds, round
 * donation counts / totals, a fresh record day — each linked to the template
 * that tells that story best.
 */
export function detectMoments(aggregates: Aggregates, t: TFn, goal?: number): Moment[] {
  const moments: Moment[] = [];

  if (goal && goal > 0) {
    const pct = (aggregates.totalAmount / goal) * 100;
    const crossed = GOAL_THRESHOLDS.find((th) => pct >= th);
    if (crossed) {
      moments.push({
        id: `goal-${crossed}`,
        icon: '🎯',
        text: t(`moments.goal_${crossed}`),
        templateId: 'milestone',
      });
    }
  }

  const countCrossed = COUNT_THRESHOLDS.find((th) => aggregates.donationCount >= th);
  if (countCrossed) {
    moments.push({
      id: `count-${countCrossed}`,
      icon: '💯',
      text: t('moments.donations', { count: countCrossed }),
      templateId: 'donors-count',
    });
  }

  const totalCrossed = TOTAL_THRESHOLDS.find((th) => aggregates.totalAmount >= th);
  if (totalCrossed) {
    moments.push({
      id: `total-${totalCrossed}`,
      icon: '💰',
      text: t('moments.total', { amount: formatCurrency(totalCrossed) }),
      templateId: 'progress',
    });
  }

  // A record day is only news while it's fresh (within the last 2 days of data)
  const bestDay = findBestDay(aggregates);
  if (bestDay) {
    const bestTime = new Date(bestDay.date).getTime();
    const lastTime = aggregates.lastDate.getTime();
    if (lastTime - bestTime <= 2 * 24 * 60 * 60 * 1000) {
      moments.push({
        id: 'record-day',
        icon: '🔥',
        text: t('moments.recordDay', { amount: formatCurrency(bestDay.amount) }),
        templateId: 'daily-activity',
      });
    }
  }

  return moments;
}
