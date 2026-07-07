import type { RawDonation } from '../types';
import type { CampaignMeta } from './campaignStore';
import { normalizeDonations } from './csvParser';
import { isAnonymousDonor } from './dataAggregator';

// Cross-campaign analytics: everything the comparison view needs, computed in
// one pass over the library. Donor identity matching is heuristic (normalized
// name equality) — good enough for "hey, Олена donated to all three jars".

export interface CampaignAnalysis {
  meta: CampaignMeta;
  totalAmount: number;
  donationCount: number;
  medianDonation: number;
  days: number; // inclusive campaign length in days
  avgPerDay: number;
  cumulativeByDay: number[]; // cumulative total per campaign day (index 0 = first day)
}

export interface CrossDonor {
  name: string; // display form (first spelling seen)
  campaignCount: number;
  donationCount: number;
  totalAmount: number;
}

export interface QuarterTotal {
  year: number;
  quarter: number; // 1–4
  amount: number;
  count: number;
  campaignCount: number; // campaigns with at least one donation in this quarter
}

export interface CrossCampaignStats {
  campaigns: CampaignAnalysis[]; // newest first (by campaign start)
  totalAmount: number;
  totalDonations: number;
  uniqueDonors: number; // distinct named donors across all campaigns
  crossDonors: CrossDonor[]; // named donors present in 2+ campaigns, biggest first
  quarters: QuarterTotal[]; // chronological
}

// The jar owner's own top-ups: same "identity" in every campaign, so listing
// them as the top repeat donor would be noise (see extractDonorName()).
const SELF_DONATION = 'Власний внесок';

const dayIndex = (t: Date, start: Date) => {
  const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const d1 = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((d1 - d0) / 86_400_000);
};

export function analyzeCampaigns(items: Array<{ meta: CampaignMeta; rawData: RawDonation[] }>): CrossCampaignStats {
  const campaigns: CampaignAnalysis[] = [];
  const donorMap = new Map<string, { display: string; campaignIds: Set<string>; donationCount: number; totalAmount: number }>();
  const quarterMap = new Map<string, QuarterTotal & { campaignIds: Set<string> }>();

  let totalAmount = 0;
  let totalDonations = 0;

  for (const { meta, rawData } of items) {
    const { donations } = normalizeDonations(rawData);
    if (donations.length === 0) continue;

    const sorted = [...donations].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const start = sorted[0].timestamp;
    const days = dayIndex(sorted[sorted.length - 1].timestamp, start) + 1;

    const cumulativeByDay = new Array<number>(days).fill(0);
    let sum = 0;
    const amounts: number[] = [];

    for (const d of sorted) {
      amounts.push(d.amount);
      cumulativeByDay[dayIndex(d.timestamp, start)] += d.amount;
      sum += d.amount;

      // Donor identity across campaigns
      if (!isAnonymousDonor(d.donor) && d.donor !== SELF_DONATION) {
        const key = d.donor!.toLowerCase().trim().replace(/\s+/g, ' ');
        const entry = donorMap.get(key) ?? { display: d.donor!.trim(), campaignIds: new Set<string>(), donationCount: 0, totalAmount: 0 };
        entry.campaignIds.add(meta.id);
        entry.donationCount += 1;
        entry.totalAmount += d.amount;
        donorMap.set(key, entry);
      }

      // Quarter totals by actual donation date
      const year = d.timestamp.getFullYear();
      const quarter = Math.floor(d.timestamp.getMonth() / 3) + 1;
      const qKey = `${year}-${quarter}`;
      const q = quarterMap.get(qKey) ?? { year, quarter, amount: 0, count: 0, campaignCount: 0, campaignIds: new Set<string>() };
      q.amount += d.amount;
      q.count += 1;
      q.campaignIds.add(meta.id);
      quarterMap.set(qKey, q);
    }

    // Turn per-day sums into a running total
    for (let i = 1; i < days; i++) cumulativeByDay[i] += cumulativeByDay[i - 1];

    const mid = Math.floor(amounts.length / 2);
    const ascending = [...amounts].sort((a, b) => a - b);
    const medianDonation = amounts.length % 2 ? ascending[mid] : (ascending[mid - 1] + ascending[mid]) / 2;

    campaigns.push({
      meta,
      totalAmount: sum,
      donationCount: donations.length,
      medianDonation,
      days,
      avgPerDay: sum / days,
      cumulativeByDay,
    });

    totalAmount += sum;
    totalDonations += donations.length;
  }

  campaigns.sort((a, b) => b.meta.summary.firstDate.localeCompare(a.meta.summary.firstDate));

  const crossDonors: CrossDonor[] = [...donorMap.values()]
    .filter((d) => d.campaignIds.size >= 2)
    .map((d) => ({ name: d.display, campaignCount: d.campaignIds.size, donationCount: d.donationCount, totalAmount: d.totalAmount }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const quarters: QuarterTotal[] = [...quarterMap.values()]
    .map(({ campaignIds, ...q }) => ({ ...q, campaignCount: campaignIds.size }))
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter);

  return { campaigns, totalAmount, totalDonations, uniqueDonors: donorMap.size, crossDonors, quarters };
}

// ─── PNG report («Звіти») ─────────────────────────────────────────────────────

export interface ReportPeriod {
  kind: 'all' | 'year' | 'quarter';
  year?: number;
  quarter?: number; // 1–4
}

export interface ReportStats {
  campaignCount: number; // campaigns with at least one donation in the period
  totalAmount: number;
  donationCount: number;
  uniqueDonors: number; // named, merged across campaigns
  anonymousDonations: number;
  topCampaigns: Array<{ name: string; amount: number }>; // biggest first, top 3
  firstDate: Date | null; // actual donation span inside the period
  lastDate: Date | null;
}

/** Aggregates the whole library over one reporting period (quarter / year / all time). */
export function buildReport(items: Array<{ meta: CampaignMeta; rawData: RawDonation[] }>, period: ReportPeriod): ReportStats {
  const inPeriod = (t: Date) => {
    if (period.kind === 'all') return true;
    if (t.getFullYear() !== period.year) return false;
    return period.kind === 'year' || Math.floor(t.getMonth() / 3) + 1 === period.quarter;
  };

  const donorKeys = new Set<string>();
  const campaignTotals: Array<{ name: string; amount: number }> = [];
  let totalAmount = 0;
  let donationCount = 0;
  let anonymousDonations = 0;
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  for (const { meta, rawData } of items) {
    const { donations } = normalizeDonations(rawData);
    let campaignAmount = 0;

    for (const d of donations) {
      if (!inPeriod(d.timestamp)) continue;
      campaignAmount += d.amount;
      donationCount += 1;
      if (!firstDate || d.timestamp < firstDate) firstDate = d.timestamp;
      if (!lastDate || d.timestamp > lastDate) lastDate = d.timestamp;
      if (isAnonymousDonor(d.donor)) {
        anonymousDonations += 1;
      } else if (d.donor !== SELF_DONATION) {
        donorKeys.add(d.donor!.toLowerCase().trim().replace(/\s+/g, ' '));
      }
    }

    if (campaignAmount > 0) {
      campaignTotals.push({ name: meta.name, amount: campaignAmount });
      totalAmount += campaignAmount;
    }
  }

  return {
    campaignCount: campaignTotals.length,
    totalAmount,
    donationCount,
    uniqueDonors: donorKeys.size,
    anonymousDonations,
    topCampaigns: campaignTotals.sort((a, b) => b.amount - a.amount).slice(0, 3),
    firstDate,
    lastDate,
  };
}
