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
 * Generates 5-6 human-friendly insights from aggregates.
 * Language follows the "explain it like I'm tired" principle:
 * short sentences, emotional tone, no raw stats where a story fits better.
 */
export function generateInsights(aggregates: Aggregates): Insight[] {
  const insights: Insight[] = [];

  // 1. Total collected (hero insight)
  insights.push({
    icon: '💰',
    title: 'Всього зібрано',
    value: formatCurrency(aggregates.totalAmount),
    description: `${aggregates.donationCount} людей підтримали збір 💙💛`,
    type: 'insight',
  });

  // 2. Average donation — say "most people donate around X–Y" not a raw mean
  const humanRange = getDonationRange(aggregates.avgDonation);
  insights.push({
    icon: '📊',
    title: 'Типовий донат',
    value: humanRange,
    description: buildAvgDescription(aggregates),
    type: 'insight',
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
      description: `${dayName} — зібрано ${formatCurrency(bestDay.amount)} за один день`,
      type: 'insight',
    });
  }

  // 4. Peak hour — reworded as a posting tip
  const peakHour = findPeakHour(aggregates);
  if (peakHour) {
    const timeRange = `${peakHour.hour}:00–${peakHour.hour + 1}:00`;

    insights.push({
      icon: '⏰',
      title: 'Час активності',
      value: timeRange,
      description: `Люди найчастіше донатять о ${peakHour.hour}:00 — плануйте пости на цей час`,
      type: 'insight',
    });
  }

  // 5. Campaign duration
  const duration = getCampaignDuration(aggregates);
  insights.push({
    icon: '📅',
    title: 'Тривалість збору',
    value: `${duration} ${getDaysWord(duration)}`,
    description: `З ${formatUkrainianDate(aggregates.firstDate)} по ${formatUkrainianDate(aggregates.lastDate)}`,
    type: 'insight',
  });

  // 6. Donation distribution — emotional interpretation, not raw percentages
  const distributionInsight = generateDistributionInsight(aggregates);
  if (distributionInsight) {
    insights.push(distributionInsight);
  }

  return insights;
}

/**
 * Returns a human-readable donation range based on the average.
 * "83 UAH" → "50–100 ₴"
 */
function getDonationRange(avg: number): string {
  if (avg < 50) return 'до 50 ₴';
  if (avg < 100) return '50–100 ₴';
  if (avg < 200) return '100–200 ₴';
  if (avg < 500) return '200–500 ₴';
  if (avg < 1000) return '500–1 000 ₴';
  if (avg < 5000) return '1 000–5 000 ₴';
  return 'понад 5 000 ₴';
}

/**
 * Builds a human description for the average donation card.
 */
function buildAvgDescription(aggregates: Aggregates): string {
  const { smallDonations, mediumDonations, largeDonations, donationCount } = aggregates;
  const smallPct = Math.round((smallDonations / donationCount) * 100);
  const mediumPct = Math.round((mediumDonations / donationCount) * 100);
  const largePct = Math.round((largeDonations / donationCount) * 100);

  if (smallPct >= 60) {
    return `${smallPct}% донатів — менше 100 ₴. Кожна гривня важлива 💙`;
  }
  if (largePct >= 30) {
    return `${largePct}% донатів — більше 1 000 ₴. Ваші донатери дуже щедрі 💛`;
  }
  return `${mediumPct}% — від 100 до 1 000 ₴. Середня підтримка, широка аудиторія`;
}

/**
 * Generates insight about donation size distribution with emotional copy.
 */
function generateDistributionInsight(aggregates: Aggregates): Insight | null {
  const total = aggregates.donationCount;
  const smallPct = Math.round((aggregates.smallDonations / total) * 100);
  const mediumPct = Math.round((aggregates.mediumDonations / total) * 100);
  const largePct = Math.round((aggregates.largeDonations / total) * 100);

  let value: string;
  let description: string;

  if (smallPct > mediumPct && smallPct > largePct) {
    value = `${smallPct}% маленьких донатів`;
    description = 'Багато людей донатять потроху 💙💛';
  } else if (largePct >= 20) {
    value = `${largePct}% великих`;
    description = `${largePct}% донатів — понад 1 000 ₴. Серед вас є справжні патрони! 🙌`;
  } else {
    value = `${mediumPct}% середніх`;
    description = 'Більшість донатять 100–1 000 ₴ — стабільна, довіряюча аудиторія';
  }

  return {
    icon: '⚖️',
    title: 'Хто донатить',
    value,
    description,
    type: 'insight',
  };
}

// ─── Actionable recommendations ("Що робити далі?") ──────────────────────────

/**
 * Generates 2–4 actionable recommendations based on aggregates + optional goal.
 * These surface on Screen 2 below the regular insights.
 */
export function generateActionableInsights(aggregates: Aggregates, goal?: number): Insight[] {
  const actions: Insight[] = [];

  // 1. Timing: best hour to post
  const peakHour = findPeakHour(aggregates);
  if (peakHour) {
    const now = new Date();
    const hourLabel = `${peakHour.hour}:00–${peakHour.hour + 1}:00`;
    const isStillToday = now.getHours() < peakHour.hour;
    const description = isStillToday
      ? `Опублікуйте сьогодні о ${peakHour.hour}:00 — саме тоді ваша аудиторія донатить найбільше`
      : `Публікуйте щодня о ${peakHour.hour}:00 — це ваш пік активності донатерів`;

    actions.push({
      icon: '⏰',
      title: 'Найкращий час для посту',
      value: hourLabel,
      description,
      type: 'action',
    });
  }

  // 2. Momentum: compare last 2 days in the dataset
  const momentumInsight = buildMomentumInsight(aggregates);
  if (momentumInsight) actions.push(momentumInsight);

  // 3. Goal pacing (only when goal is provided and not yet reached)
  if (goal && aggregates.totalAmount < goal) {
    const daysLeft = estimateDaysToGoal(aggregates, goal);
    if (daysLeft !== null) {
      actions.push({
        icon: '🎯',
        title: 'Прогноз виконання',
        value: `~${daysLeft} ${getDaysWord(daysLeft)}`,
        description: `За поточним темпом ви досягнете мети приблизно через ${daysLeft} ${getDaysWord(daysLeft)}`,
        type: 'action',
      });
    }
  }

  // 4. Donation pattern: suggest fixed amounts if mostly small donations
  const total = aggregates.donationCount;
  const smallPct = (aggregates.smallDonations / total) * 100;
  if (smallPct > 60) {
    actions.push({
      icon: '💸',
      title: 'Порада для збору',
      value: `${Math.round(smallPct)}% малих донатів`,
      description: 'Спробуйте запропонувати фіксовані суми: 50, 100 або 200 ₴ — це знімає бар\'єр рішення',
      type: 'action',
    });
  }

  return actions;
}

/**
 * Compares donation volume of the last 2 days in the dataset.
 * Returns a momentum insight if there's a >20% change.
 */
function buildMomentumInsight(aggregates: Aggregates): Insight | null {
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
      title: 'Активність знизилась',
      value: `−${Math.abs(changePct)}% порівняно з попереднім днем`,
      description: 'Саме час опублікувати оновлення — нагадайте аудиторії про збір',
      type: 'action',
    };
  }

  if (changePct >= 20) {
    return {
      icon: '🚀',
      title: 'Активність зростає',
      value: `+${changePct}% порівняно з попереднім днем`,
      description: 'Зараз ваша аудиторія залучена — поділіться результатами!',
      type: 'action',
    };
  }

  return null;
}

/**
 * Uses the average daily rate from the last 7 days (or all available days)
 * to estimate how many days until the goal is reached.
 */
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

// ─── Ukrainian language helpers ───────────────────────────────────────────────

export function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дні';
  if (days >= 5 && days <= 20) return 'днів';
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

  const percentage = Math.round((current / goal) * 100);

  if (percentage >= 150) {
    return `Фантастика! ${percentage}% від мети — збір перевершив усі очікування! 🎉`;
  } else if (percentage >= 100) {
    return `Мету досягнуто і перевиконано! 🎉 ${percentage}% — ви просто зірки 💙💛`;
  } else if (percentage >= 90) {
    return `Зовсім трохи залишилось! ${percentage}% зібрано — фінальний ривок 💪`;
  } else if (percentage >= 75) {
    return `Три чверті позаду! ${percentage}% вже зібрано — не зупиняємось`;
  } else if (percentage >= 50) {
    return `Ми на півшляху! ${percentage}% зібрано — продовжуємо разом`;
  } else {
    return `${percentage}% зібрано — кожен донат наближає до мети!`;
  }
}
