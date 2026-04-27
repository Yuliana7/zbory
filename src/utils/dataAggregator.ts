import type { Donation, Aggregates } from '../types';

/**
 * Aggregates donation data into useful statistics
 */
export function aggregateDonations(donations: Donation[]): Aggregates {
  if (donations.length === 0) {
    throw new Error('No donations to aggregate');
  }

  // Sort donations by timestamp (oldest first)
  const sortedDonations = [...donations].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Basic statistics
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const donationCount = donations.length;
  const avgDonation = totalAmount / donationCount;

  const amounts = donations.map(d => d.amount);
  const minDonation = Math.min(...amounts);
  const maxDonation = Math.max(...amounts);

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
  const topDonors = Array.from(donorMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    totalAmount,
    donationCount,
    avgDonation,
    minDonation,
    maxDonation,
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
  };
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

  const day = d.getDate();
  const month = d.toLocaleDateString('uk-UA', { month: 'long' });
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
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