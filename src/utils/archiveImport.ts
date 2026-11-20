// Closed jars straight into the archive, from their statements: for jars the app never tracked (old
// friendly jars whose links are gone, past fundraisers). One statement makes one closed jar.

import type { OwnJar, RawDonation } from '../types';
import { archiveCampaign, computeCampaignSummary, saveCampaign, type CampaignMeta, type CampaignSummary } from './campaignStore';
import { normalizeDonations } from './csvParser';
import { aggregateDonations } from './dataAggregator';
import { generateId } from './id';
import { saveOwnJar } from './ownJars';

/** What the statements become: the user's own friendly jars, or main jars (projects). */
export type ImportKind = 'ownJar' | 'project';

export interface ImportDraft {
  key: string;
  fileName: string;
  rows: RawDonation[];
  summary: CampaignSummary;
  /** what the jar raised, counted as its page counts it (refunds out) */
  amount: number;
  /** editable before importing */
  name: string;
  /** the day it closed (YYYY-MM-DD): the archive files it under that year. Defaults to the last donation. */
  closedOn: string;
  /** the goal, as typed (UAH); empty = none */
  goal: string;
  /** the same statement is already in the archive (or the app): left out unless the user takes it */
  duplicate: boolean;
  /** left out of the import */
  skip: boolean;
}

/** A statement's fingerprint: its donations, total and first and last day. */
export const statementSignature = (s: CampaignSummary) => `${s.donationCount}|${Math.round(s.totalAmount)}|${s.firstDate}|${s.lastDate}`;

/** The fingerprints of every statement the app already holds: projects' and own jars'. */
export function knownSignatures(campaigns: CampaignMeta[], ownJars: OwnJar[]): Set<string> {
  return new Set([
    ...campaigns.map((c) => statementSignature(c.summary)),
    ...ownJars.flatMap((j) => (j.statement ? [statementSignature(computeCampaignSummary(j.statement))] : [])),
  ]);
}

/** «Jar_statement_31.08.2026_185648.csv» → «Jar statement 31.08.2026 185648»: something to edit, as
 * the statement doesn't name its jar. */
export const nameFromFile = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A draft from one statement, or null when it holds no donations. */
export function draftFromStatement(fileName: string, rows: RawDonation[], known: Set<string>): ImportDraft | null {
  const summary = computeCampaignSummary(rows);
  if (summary.donationCount === 0) return null;
  const duplicate = known.has(statementSignature(summary));
  const { donations, withdrawals, currentBalance } = normalizeDonations(rows);
  const amount = aggregateDonations(donations, withdrawals, currentBalance).totalAmount;
  return { key: generateId(), fileName, rows, summary, amount, name: nameFromFile(fileName), closedOn: summary.lastDate, goal: '', duplicate, skip: duplicate };
}

/** Noon on the closing day (a day, not a moment: noon keeps it on that day in any zone the user is in). */
const closedAt = (day: string) => new Date(`${day}T12:00:00`).getTime();

const parseGoal = (raw: string) => {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Files the drafts not skipped into the archive as `kind`; returns the years they went under. */
export async function importToArchive(drafts: ImportDraft[], kind: ImportKind, now: number = Date.now()): Promise<number[]> {
  const years: number[] = [];
  for (const d of drafts) {
    if (d.skip) continue;
    const archivedAt = closedAt(d.closedOn || d.summary.lastDate);
    const name = d.name.trim() || nameFromFile(d.fileName);
    const goal = parseGoal(d.goal);
    if (kind === 'project') {
      const meta = await saveCampaign({ name, rawData: d.rows, fileName: d.fileName, goal });
      await archiveCampaign(meta.id, archivedAt);
    } else {
      // no link: never read from Monobank (closed), and known only by its statement, whose amount it takes
      const jar: OwnJar = {
        id: generateId(),
        name,
        raised: d.amount,
        ...(goal ? { target: goal } : null),
        jarId: '',
        closed: true,
        addedAt: now,
        archivedAt,
        statement: d.rows,
        statementAddedAt: now,
      };
      await saveOwnJar(jar);
    }
    years.push(new Date(archivedAt).getFullYear());
  }
  return years;
}
