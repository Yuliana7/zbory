// The archive: closed projects and the user's own friendly jars, filed by the year they were closed.
// Nothing here reads a project's rows: the list works from what each project's meta holds.

import type { OwnJar } from '../types';
import type { CampaignMeta } from './campaignStore';

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
  /** total of the projects closed in each month, January first */
  byMonth: number[];
}

/** The year card: what the projects closed that year raised together. Friendly jars are the projects'
 * helpers plus the user's own archived jars — except those feeding one of these projects, which the
 * project's helpers already count. Own jars' money is never added: it lands in some main jar's total. */
export function yearSummary(campaigns: CampaignMeta[], ownJars: OwnJar[] = []): YearSummary {
  const out: YearSummary = { total: 0, count: 0, donations: 0, friends: 0, byMonth: Array(12).fill(0) };
  for (const c of campaigns) {
    out.total += c.summary.totalAmount;
    out.count += 1;
    out.donations += c.summary.donationCount;
    out.friends += c.archive?.friendsCount ?? 0;
    out.byMonth[new Date(c.archivedAt ?? 0).getMonth()] += c.summary.totalAmount;
  }
  const fed = new Set(campaigns.map((c) => c.monobankJar?.shortId).filter(Boolean));
  out.friends += ownJars.filter((j) => !j.main?.shortId || !fed.has(j.main.shortId)).length;
  return out;
}

/** The user's own friendly jars that feed this project's main jar: the close sheet offers to archive them too. */
export function ownJarsFeeding(jars: OwnJar[], mainShortId: string | undefined): OwnJar[] {
  if (!mainShortId) return [];
  return jars.filter((j) => !isArchived(j) && j.main?.shortId === mainShortId);
}

export const ARCHIVE_PAGE_SIZE = 10;
