import type { Donation, Withdrawal, Aggregates } from '../types';

/**
 * Aggregates donation data into useful statistics.
 * withdrawals and currentBalance are optional — callers that don't have them
 * (e.g. date-range re-aggregation in ExportPage) get sensible zero defaults.
 */
export function aggregateDonations(
  donations: Donation[],
  withdrawals: Withdrawal[] = [],
  currentBalance?: number,
): Aggregates {
  if (donations.length === 0) {
    throw new Error('No donations to aggregate');
  }

  // Sort donations by timestamp (oldest first)
  const sortedDonations = [...donations].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Basic statistics
  const totalRaised = donations.reduce((sum, d) => sum + d.amount, 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  // Only apply clean-total logic when currentBalance was explicitly provided.
  // Date-range re-aggregation callers omit it, so they fall back to totalRaised.
  const hasBalanceData = currentBalance !== undefined;
  const impliedRefunds = hasBalanceData
    ? Math.max(0, totalRaised - totalWithdrawn - currentBalance!)
    : 0;
  const totalAmount = hasBalanceData
    ? currentBalance! + totalWithdrawn
    : totalRaised;
  const donationCount = donations.length;
  const avgDonation = totalAmount / donationCount;

  const amounts = donations.map(d => d.amount).sort((a, b) => a - b);
  const minDonation = amounts[0];
  const maxDonation = amounts[amounts.length - 1];
  const medianDonation = percentile(amounts, 50);
  const p25Donation = percentile(amounts, 25);
  const p75Donation = percentile(amounts, 75);
  const modeDonation = findMode(amounts);

  // Date range
  const firstDate = sortedDonations[0].timestamp;
  const lastDate = sortedDonations[sortedDonations.length - 1].timestamp;

  // Group by day (YYYY-MM-DD)
  const byDay = new Map<string, number>();
  const byDate = new Map<string, { amount: number; count: number }>();

  for (const donation of donations) {
    const dateKey = formatDateKey(donation.timestamp);

    // Total amount per day
    byDay.set(dateKey, (byDay.get(dateKey) || 0) + donation.amount);

    // Amount and count per day
    const existing = byDate.get(dateKey) || { amount: 0, count: 0 };
    byDate.set(dateKey, {
      amount: existing.amount + donation.amount,
      count: existing.count + 1,
    });
  }

  // Group by hour (0-23)
  const byHour = new Map<number, number>();
  for (const donation of donations) {
    const hour = donation.timestamp.getHours();
    byHour.set(hour, (byHour.get(hour) || 0) + 1);
  }

  // Calculate cumulative totals for chart
  const cumulative: Array<{ date: string; total: number }> = [];
  let runningTotal = 0;

  for (const donation of sortedDonations) {
    runningTotal += donation.amount;
    const dateKey = formatDateKey(donation.timestamp);

    // Check if we already have an entry for this date
    const existingEntry = cumulative.find(entry => entry.date === dateKey);
    if (existingEntry) {
      existingEntry.total = runningTotal;
    } else {
      cumulative.push({
        date: dateKey,
        total: runningTotal,
      });
    }
  }

  // Donation size distribution
  let smallDonations = 0; // < 100 UAH
  let mediumDonations = 0; // 100-1000 UAH
  let largeDonations = 0; // > 1000 UAH

  for (const donation of donations) {
    if (donation.amount < 100) {
      smallDonations++;
    } else if (donation.amount <= 1000) {
      mediumDonations++;
    } else {
      largeDonations++;
    }
  }

  const donorMap = new Map<string, { amount: number; count: number }>();
  for (const donation of donations) {
    if (donation.donor) {
      const existing = donorMap.get(donation.donor) ?? { amount: 0, count: 0 };
      donorMap.set(donation.donor, {
        amount: existing.amount + donation.amount,
        count: existing.count + 1,
      });
    }
  }
  const donorEntries = Array.from(donorMap.entries()).map(([name, stats]) => ({ name, ...stats }));
  const topDonors = [...donorEntries].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const topDonorsByCount = [...donorEntries]
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, 10);

  return {
    totalAmount,
    totalRaised,
    donationCount,
    avgDonation,
    medianDonation,
    modeDonation,
    p25Donation,
    p75Donation,
    minDonation,
    maxDonation,
    withdrawals,
    totalWithdrawn,
    currentBalance: currentBalance ?? 0,
    impliedRefunds,
    byDay,
    byHour,
    byDate,
    cumulative,
    firstDate,
    lastDate,
    smallDonations,
    mediumDonations,
    largeDonations,
    topDonors,
    topDonorsByCount,
  };
}

/** Linear-interpolated percentile over a pre-sorted ascending array */
function percentile(sortedAmounts: number[], p: number): number {
  if (sortedAmounts.length === 0) return 0;
  const idx = (p / 100) * (sortedAmounts.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAmounts[lo];
  return sortedAmounts[lo] + (sortedAmounts[hi] - sortedAmounts[lo]) * (idx - lo);
}

/** Most frequent amount; ties resolve to the smaller amount */
function findMode(amounts: number[]): number {
  const freq = new Map<number, number>();
  for (const a of amounts) freq.set(a, (freq.get(a) || 0) + 1);
  let mode = amounts[0] ?? 0;
  let best = 0;
  for (const [amount, count] of freq) {
    if (count > best || (count === best && amount < mode)) {
      best = count;
      mode = amount;
    }
  }
  return mode;
}

export type TimeBucketKey = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Buckets donation counts into human time-of-day ranges:
 * morning 06:00–11:59, afternoon 12:00–17:59, evening 18:00–23:59, night 00:00–05:59.
 */
export function getTimeBuckets(aggregates: Aggregates): Array<{ key: TimeBucketKey; count: number }> {
  const counts: Record<TimeBucketKey, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const [hour, count] of aggregates.byHour.entries()) {
    if (hour >= 6 && hour < 12) counts.morning += count;
    else if (hour >= 12 && hour < 18) counts.afternoon += count;
    else if (hour >= 18) counts.evening += count;
    else counts.night += count;
  }
  return (['morning', 'afternoon', 'evening', 'night'] as const).map((key) => ({ key, count: counts[key] }));
}

/**
 * Formats a date as YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Finds the best day (highest donation amount)
 */
export function findBestDay(aggregates: Aggregates): { date: string; amount: number } | null {
  if (aggregates.byDay.size === 0) return null;

  let bestDate = '';
  let bestAmount = 0;

  for (const [date, amount] of aggregates.byDay.entries()) {
    if (amount > bestAmount) {
      bestAmount = amount;
      bestDate = date;
    }
  }

  return { date: bestDate, amount: bestAmount };
}

/**
 * Finds the peak hour (most donations)
 */
export function findPeakHour(aggregates: Aggregates): { hour: number; count: number } | null {
  if (aggregates.byHour.size === 0) return null;

  let peakHour = 0;
  let peakCount = 0;

  for (const [hour, count] of aggregates.byHour.entries()) {
    if (count > peakCount) {
      peakCount = count;
      peakHour = hour;
    }
  }

  return { hour: peakHour, count: peakCount };
}

/**
 * Formats amount as Ukrainian currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' ₴';
}

/**
 * Formats date in Ukrainian format
 */
export function formatUkrainianDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Formats date short (DD.MM.YYYY)
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * Gets day of week in Ukrainian
 */
export function getDayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('uk-UA', { weekday: 'long' });
}

/**
 * Calculates campaign duration in days
 */
export function getCampaignDuration(aggregates: Aggregates): number {
  const diff = aggregates.lastDate.getTime() - aggregates.firstDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}