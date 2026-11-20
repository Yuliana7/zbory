// The archive: closed projects and the user's own friendly jars, filed by the year they were closed.
// Nothing here reads a project's rows: the list works from what each project's meta holds (and an own
// jar's statement, which it carries).

import type { OwnJar, YearRecap } from '../types';
import type { CampaignMeta } from './campaignStore';
import { ownJarDonationCount } from './ownJars';

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
  /** what the projects and own jars closed in each month raised, January first */
  byMonth: number[];
}

/** The user's own jars that count on their own in a year: all but those feeding one of these projects,
 * whose money is already in that project's statement (and whose helpers already count them). */
export function ownJarsOnTheirOwn(campaigns: CampaignMeta[], ownJars: OwnJar[]): OwnJar[] {
  const fed = new Set(campaigns.map((c) => c.monobankJar?.shortId).filter(Boolean));
  return ownJars.filter((j) => !j.main?.shortId || !fed.has(j.main.shortId));
}

/** The year card: everything the user closed that year raised — the projects and their own friendly jars
 * (see ownJarsOnTheirOwn), month by month. Friendly jars are the projects' helpers plus those own jars;
 * an own jar's donations count when its statement was added. */
export function yearSummary(campaigns: CampaignMeta[], ownJars: OwnJar[] = []): YearSummary {
  const out: YearSummary = { total: 0, count: 0, donations: 0, friends: 0, byMonth: Array(12).fill(0) };
  for (const c of campaigns) {
    out.total += c.summary.totalAmount;
    out.count += 1;
    out.donations += c.summary.donationCount;
    out.friends += c.archive?.friendsCount ?? 0;
    out.byMonth[new Date(c.archivedAt ?? 0).getMonth()] += c.summary.totalAmount;
  }
  for (const j of ownJarsOnTheirOwn(campaigns, ownJars)) {
    out.total += j.raised;
    out.friends += 1;
    out.donations += ownJarDonationCount(j);
    out.byMonth[new Date(j.archivedAt ?? 0).getMonth()] += j.raised;
  }
  return out;
}

/** «Мій рік»: the year card's numbers, the biggest of its projects and own jars, and how many of those
 * with a goal reached it. */
export function yearRecap(year: number, campaigns: CampaignMeta[], ownJars: OwnJar[] = []): YearRecap {
  const s = yearSummary(campaigns, ownJars);
  const items = [
    ...campaigns.map((c) => ({ name: c.name, total: c.summary.totalAmount, goal: c.goal })),
    ...ownJarsOnTheirOwn(campaigns, ownJars).map((j) => ({ name: j.name || '—', total: j.raised, goal: j.target })),
  ];
  const biggest = [...items].sort((a, b) => b.total - a.total)[0];
  const withGoal = items.filter((i) => i.goal);
  return {
    year,
    total: s.total,
    count: s.count,
    donations: s.donations,
    friendJars: s.friends,
    byMonth: s.byMonth,
    biggest: biggest ? { name: biggest.name, total: biggest.total } : null,
    goals: { set: withGoal.length, reached: withGoal.filter((i) => i.total >= i.goal!).length },
  };
}

/** The user's own friendly jars that feed this project's main jar: the close sheet offers to archive them too. */
export function ownJarsFeeding(jars: OwnJar[], mainShortId: string | undefined): OwnJar[] {
  if (!mainShortId) return [];
  return jars.filter((j) => !isArchived(j) && j.main?.shortId === mainShortId);
}

export const ARCHIVE_PAGE_SIZE = 10;
