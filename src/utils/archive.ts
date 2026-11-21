// The archive: closed projects and the user's own friendly jars, filed by the year they were closed.
// Nothing here reads a project's rows: the list works from what each project's meta holds (and an own
// jar's statement, which it carries).

import type { OwnJar, YearRecap } from '../types';
import { computeCampaignSummary, type CampaignMeta } from './campaignStore';
import { ownJarDataset, ownJarDays, ownJarDonationCount } from './ownJars';

export const isArchived = (item: { archivedAt?: number }) => !!item.archivedAt;

/** The year a closed project or jar is filed under: the year it was closed, on the user's clock. */
export const archiveYear = (item: { archivedAt?: number }) => new Date(item.archivedAt ?? 0).getFullYear();

/** Every year something was closed in, newest first. */
export function archiveYears(items: Array<{ archivedAt?: number }>): number[] {
  return [...new Set(items.filter(isArchived).map(archiveYear))].sort((a, b) => b - a);
}

/** `null` = every year. Newest closed first. */
export function inYear<T extends { archivedAt?: number }>(items: T[], year: number | null): T[] {
  return items
    .filter((i) => isArchived(i) && (year === null || archiveYear(i) === year))
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
}

/** Search by name: case and extra spaces don't matter, any part of the name matches. */
export function matchesName(name: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ');
  return q === '' || name.toLocaleLowerCase('uk').replace(/\s+/g, ' ').includes(q);
}

export interface YearSummary {
  total: number;
  count: number;
  donations: number;
  friends: number;
  /** for one year: what came in each month of it (donations by their date), January first */
  byMonth: number[];
}

/** A closing day (YYYY-MM-DD) as the moment it's filed under: noon, so it stays that day in any time zone. */
export const closedAtOf = (day: string) => new Date(`${day}T12:00:00`).getTime();

/** YYYY-MM-DD on the user's clock. */
export const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** When a friendly jar last moved, as the day to close it on: its statement's last donation, else the
 * last time the app saw its amount change, else today. */
export function ownJarLastDay(jar: OwnJar, now: number = Date.now()): string {
  const last = jar.statement ? computeCampaignSummary(jar.statement).lastDate : '';
  if (last) return last;
  const changes = (jar.history ?? []).map((h) => h.at);
  return dayOf(changes.length ? Math.max(...changes) : now);
}

/** The user's own jars that count on their own in a year: all but those feeding one of these projects,
 * whose money is already in that project's statement (and whose helpers already count them). */
export function ownJarsOnTheirOwn(campaigns: CampaignMeta[], ownJars: OwnJar[]): OwnJar[] {
  const fed = new Set(campaigns.map((c) => c.monobankJar?.shortId).filter(Boolean));
  return ownJars.filter((j) => !j.main?.shortId || !fed.has(j.main.shortId));
}

/** What an own jar raised by month («YYYY-MM» → UAH): its statement's donations, else the changes of
 * its amount the app saw (ownJarDays). */
function ownJarMonths(jar: OwnJar): Record<string, number> {
  if (jar.statement) {
    const m = computeCampaignSummary(jar.statement).byMonth;
    if (m && Object.keys(m).length) return m;
  }
  const out: Record<string, number> = {};
  for (const d of ownJarDays(jar)) out[d.date.slice(0, 7)] = (out[d.date.slice(0, 7)] ?? 0) + d.amount;
  return out;
}

/** The year card: everything the user closed that year raised — the projects and their own friendly jars
 * (see ownJarsOnTheirOwn). Friendly jars are the user's own ones closed that year, all of them (a
 * project's helpers are other people's jars: they show on that project's page, not here); an own jar's
 * donations count when its statement was added. The month bars (for one `year`) show when the money
 * came in: donations by their month, in that year. */
export function yearSummary(campaigns: CampaignMeta[], ownJars: OwnJar[] = [], year: number | null = null): YearSummary {
  const out: YearSummary = { total: 0, count: 0, donations: 0, friends: ownJars.length, byMonth: Array(12).fill(0) };
  const addMonths = (months: Record<string, number> | undefined, fallbackAt: number, total: number) => {
    if (year === null) return;
    if (!months || Object.keys(months).length === 0) {
      // nothing by month known: all of it in the month it closed, if that's this year
      if (new Date(fallbackAt).getFullYear() === year) out.byMonth[new Date(fallbackAt).getMonth()] += total;
      return;
    }
    for (const [ym, amount] of Object.entries(months)) {
      if (Number(ym.slice(0, 4)) === year) out.byMonth[Number(ym.slice(5, 7)) - 1] += amount;
    }
  };
  for (const c of campaigns) {
    out.total += c.summary.totalAmount;
    out.count += 1;
    out.donations += c.summary.donationCount;
    addMonths(c.summary.byMonth, c.archivedAt ?? 0, c.summary.totalAmount);
  }
  for (const j of ownJarsOnTheirOwn(campaigns, ownJars)) {
    out.total += j.raised;
    out.donations += ownJarDonationCount(j);
    addMonths(ownJarMonths(j), j.archivedAt ?? 0, j.raised);
  }
  return out;
}

/** Whether a closed jar reached its goal: by its numbers when it had one, else what the user said
 * (undefined: neither — it isn't counted among the goals). */
export const goalOutcome = (total: number, goal: number | undefined, said: boolean | undefined) =>
  goal ? total >= goal : said;

/** The year's closed jars with no goal and no word on it yet: «Мій рік» asks about them before it counts
 * goals reached. */
export function goalsUnsaid(campaigns: CampaignMeta[], ownJars: OwnJar[]): Array<{ kind: 'project' | 'ownJar'; id: string; name: string; total: number }> {
  return [
    ...campaigns.filter((c) => !c.goal && c.archive?.goalReached === undefined).map((c) => ({ kind: 'project' as const, id: c.id, name: c.name, total: c.summary.totalAmount })),
    ...ownJarsOnTheirOwn(campaigns, ownJars)
      .filter((j) => !j.target && j.goalReached === undefined)
      .map((j) => ({ kind: 'ownJar' as const, id: j.id, name: j.name || '—', total: j.raised })),
  ];
}

/** «Мій рік»: the year card's numbers, the biggest of its projects and own jars, and how many of those
 * with a goal (or with the user's word on it) reached it. */
export function yearRecap(year: number, campaigns: CampaignMeta[], ownJars: OwnJar[] = []): YearRecap {
  const s = yearSummary(campaigns, ownJars, year);
  const own = ownJarsOnTheirOwn(campaigns, ownJars);
  const items = [
    ...campaigns.map((c) => ({ name: c.name, total: c.summary.totalAmount, reached: goalOutcome(c.summary.totalAmount, c.goal, c.archive?.goalReached) })),
    ...own.map((j) => ({ name: j.name || '—', total: j.raised, reached: goalOutcome(j.raised, j.target, j.goalReached) })),
  ];
  const biggest = [...items].sort((a, b) => b.total - a.total)[0];
  const known = items.filter((i) => i.reached !== undefined);
  return {
    year,
    total: s.total,
    count: s.count,
    donations: s.donations,
    friendJars: s.friends,
    byMonth: s.byMonth,
    biggest: biggest ? { name: biggest.name, total: biggest.total } : null,
    goals: { set: known.length, reached: known.filter((i) => i.reached).length },
    unstated: own.filter((j) => !ownJarDataset(j)).map((j) => ({ name: j.name || '—', amount: j.raised, closedAt: j.archivedAt ?? 0, days: ownJarDays(j) })),
    jars: campaigns.length + own.length,
  };
}

/** The user's own friendly jars that feed this project's main jar: the close sheet offers to archive them too. */
export function ownJarsFeeding(jars: OwnJar[], mainShortId: string | undefined): OwnJar[] {
  if (!mainShortId) return [];
  return jars.filter((j) => !isArchived(j) && j.main?.shortId === mainShortId);
}

export const ARCHIVE_PAGE_SIZE = 10;
