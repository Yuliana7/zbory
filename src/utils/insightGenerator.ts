import type { Aggregates, Insight } from '../types';
import {
  formatCurrency,
  formatUkrainianDate,
  getDayOfWeek,
  findBestDay,
  findPeakHour,
  getCampaignDuration,
} from './dataAggregator';

/**
 * Generates 5-6 emotional, user-friendly insights from aggregates
 * These are designed to be Instagram-ready storytelling elements
 */
export function generateInsights(aggregates: Aggregates): Insight[] {
  const insights: Insight[] = [];

  // 1. Total collected (main insight)
  insights.push({
    icon: '💰',
    title: 'Всього зібрано',
    value: formatCurrency(aggregates.totalAmount),
    description: `Дякуємо ${aggregates.donationCount} донатерам за підтримку 💙💛`,
  });

  // 2. Average donation
  insights.push({
    icon: '📊',
    title: 'Середній донат',
    value: formatCurrency(aggregates.avgDonation),
    description: `Від ${formatCurrency(aggregates.minDonation)} до ${formatCurrency(aggregates.maxDonation)}`,
  });

  // 3. Best day
  const bestDay = findBestDay(aggregates);
  if (bestDay) {
    const bestDate = new Date(bestDay.date);
    const dayName = getDayOfWeek(bestDate);

    insights.push({
      icon: '🔥',
      title: 'Найкращий день',
      value: formatUkrainianDate(bestDate),
      description: `${dayName} • ${formatCurrency(bestDay.amount)}`,
    });
  }

  // 4. Peak hour
  const peakHour = findPeakHour(aggregates);
  if (peakHour) {
    const timeRange = `${peakHour.hour}:00–${peakHour.hour + 1}:00`;

    insights.push({
      icon: '⏰',
      title: 'Найактивніша година',
      value: timeRange,
      description: `${peakHour.count} донатів у цей час`,
    });
  }

  // 5. Campaign duration
  const duration = getCampaignDuration(aggregates);
  insights.push({
    icon: '📅',
    title: 'Тривалість збору',
    value: `${duration} ${getDaysWord(duration)}`,
    description: `З ${formatUkrainianDate(aggregates.firstDate)} по ${formatUkrainianDate(aggregates.lastDate)}`,
  });

  // 6. Donation distribution
  const distributionInsight = generateDistributionInsight(aggregates);
  if (distributionInsight) {
    insights.push(distributionInsight);
  }

  return insights;
}

/**
 * Generates insight about donation size distribution
 */
function generateDistributionInsight(aggregates: Aggregates): Insight | null {
  const total = aggregates.donationCount;
  const smallPct = Math.round((aggregates.smallDonations / total) * 100);
  const mediumPct = Math.round((aggregates.mediumDonations / total) * 100);
  const largePct = Math.round((aggregates.largeDonations / total) * 100);

  // Find dominant category
  let dominantCategory = '';
  let dominantPct = 0;

  if (smallPct > mediumPct && smallPct > largePct) {
    dominantCategory = 'малих';
    dominantPct = smallPct;
  } else if (mediumPct > largePct) {
    dominantCategory = 'середніх';
    dominantPct = mediumPct;
  } else {
    dominantCategory = 'великих';
    dominantPct = largePct;
  }

  return {
    icon: '⚖️',
    title: 'Розподіл донатів',
    value: `${dominantPct}% ${dominantCategory}`,
    description: `Малі (<100₴): ${smallPct}% • Середні (100-1000₴): ${mediumPct}% • Великі (>1000₴): ${largePct}%`,
  };
}

/**
 * Gets the correct Ukrainian word form for "days"
 * Ukrainian has 3 forms: день, дні, днів
 */
function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дні';
  if (days >= 5 && days <= 20) return 'днів';

  // For 21+, check last digit
  const lastDigit = days % 10;
  if (lastDigit === 1) return 'день';
  if (lastDigit >= 2 && lastDigit <= 4) return 'дні';
  return 'днів';
}

/**
 * Generates a thank you message based on the total amount
 */
export function generateThankYouMessage(totalAmount: number, donationCount: number): string {
  if (totalAmount >= 1000000) {
    return `Неймовірно! Разом ми зібрали понад мільйон гривень! ${donationCount} донатерів об'єдналися заради спільної мети 💙💛`;
  } else if (totalAmount >= 500000) {
    return `Вражаюче! Пів мільйона гривень зібрано завдяки ${donationCount} небайдужим людям. Ви — неймовірні! 💙💛`;
  } else if (totalAmount >= 100000) {
    return `Дякуємо кожному з ${donationCount} донатерів! Разом ми зібрали більше 100 тисяч гривень 💙💛`;
  } else if (totalAmount >= 50000) {
    return `${donationCount} небайдужих людей допомогли зібрати ${formatCurrency(totalAmount)}. Ви — дива! 💙💛`;
  } else {
    return `Щире дякую кожному з ${donationCount} донатерів за вашу підтримку 💙💛`;
  }
}

/**
 * Generates a progress message
 */
export function generateProgressMessage(current: number, goal?: number): string {
  if (!goal) {
    return `Зібрано ${formatCurrency(current)}`;
  }

  const percentage = Math.min(Math.round((current / goal) * 100), 100);

  if (percentage >= 100) {
    return `Мету досягнуто! 🎉 Зібрано ${formatCurrency(current)} з ${formatCurrency(goal)}`;
  } else if (percentage >= 90) {
    return `Майже там! ${percentage}% зібрано — залишилося зовсім трохи`;
  } else if (percentage >= 75) {
    return `Три чверті позаду! ${percentage}% вже зібрано`;
  } else if (percentage >= 50) {
    return `Ми на півшляху! ${percentage}% вже зібрано`;
  } else {
    return `${percentage}% зібрано — продовжуємо рухатися до мети!`;
  }
}