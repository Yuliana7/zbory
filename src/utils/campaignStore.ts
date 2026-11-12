import type { FriendJar, MonobankJarRef, OwnJar, Raffle, RawDonation, SharedStyle } from '../types';
import { isOwnJar, listOwnJars, restoreOwnJars } from './ownJars';
import { normalizeDonations } from './csvParser';
import { generateId } from './id';
import { getBackend } from './db';
import { withTimestamps } from './timestamps';

// Campaign library: named datasets persisted in IndexedDB so volunteers can
// keep every jar they've run and (later) merge files and compare campaigns.
// Meta and row data live in separate object stores — listing the library must
// not deserialize thousands of rows per campaign.

const META_STORE = 'meta';
const DATA_STORE = 'data';

export interface CampaignSummary {
  totalAmount: number;
  donationCount: number;
  firstDate: string; // ISO YYYY-MM-DD
  lastDate: string;
  currentBalance: number;
}

export interface CampaignMeta {
  id: string;
  name: string;
  fileName: string | null; // null = manual entry
  goal?: number;
  /** where the data came from, if it was imported from Monobank — shown in the list, never the token */
  monobankJar?: MonobankJarRef;
  /** when the statement was last read from Monobank (ms) */
  monobankSyncedAt?: number;
  createdAt: number;
  updatedAt: number;
  summary: CampaignSummary;
}

interface CampaignData {
  id: string;
  rawData: RawDonation[];
  style?: SharedStyle;
  friends?: FriendJar[];
  raffles?: Raffle[];
  monobankJar?: MonobankJarRef;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Derives the list-view summary from raw rows via the same pipeline the app uses. */
export function computeCampaignSummary(rawData: RawDonation[]): CampaignSummary {
  const { donations, currentBalance } = normalizeDonations(rawData);
  let totalAmount = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const d of donations) {
    totalAmount += d.amount;
    const t = d.timestamp.getTime();
    if (t < first) first = t;
    if (t > last) last = t;
  }
  const isoDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    totalAmount,
    donationCount: donations.length,
    firstDate: donations.length ? isoDate(first) : '',
    lastDate: donations.length ? isoDate(last) : '',
    currentBalance,
  };
}

export interface SaveCampaignInput {
  id?: string; // existing id = update in place (keeps createdAt)
  name: string;
  rawData: RawDonation[];
  fileName: string | null;
  goal?: number;
  /** Omit to keep whatever style was previously saved for this campaign */
  style?: SharedStyle;
  /** Omit to keep the saved helpers; an empty array clears them */
  friends?: FriendJar[];
  /** Omit to keep the saved raffles; an empty array clears them */
  raffles?: Raffle[];
  /** Omit to keep the saved Monobank jar link */
  monobankJar?: MonobankJarRef;
  /** Omit to keep the saved time of the last Monobank read */
  monobankSyncedAt?: number;
}

export async function saveCampaign(input: SaveCampaignInput): Promise<CampaignMeta> {
  const kv = getBackend();
  const now = Date.now();
  const existingMeta = input.id ? ((await kv.get(META_STORE, input.id)) as CampaignMeta | undefined) : undefined;
  const existingData = input.id ? ((await kv.get(DATA_STORE, input.id)) as CampaignData | undefined) : undefined;

  const meta: CampaignMeta = {
    id: existingMeta?.id ?? input.id ?? generateId(),
    name: input.name.trim(),
    fileName: input.fileName,
    goal: input.goal,
    monobankJar: input.monobankJar ?? existingData?.monobankJar,
    monobankSyncedAt: input.monobankSyncedAt ?? existingMeta?.monobankSyncedAt,
    createdAt: existingMeta?.createdAt ?? now,
    updatedAt: now,
    summary: computeCampaignSummary(input.rawData),
  };

  await kv.put(DATA_STORE, {
    id: meta.id,
    rawData: withTimestamps(input.rawData), // projects saved before rows had a Unix time get it now
    style: input.style ?? existingData?.style,
    friends: input.friends ?? existingData?.friends,
    raffles: input.raffles ?? existingData?.raffles,
    monobankJar: input.monobankJar ?? existingData?.monobankJar,
  } satisfies CampaignData);
  await kv.put(META_STORE, meta);
  return meta;
}

/** All campaigns, most recently updated first. */
export async function listCampaigns(): Promise<CampaignMeta[]> {
  const all = (await getBackend().getAll(META_STORE)) as CampaignMeta[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCampaignMeta(id: string): Promise<CampaignMeta | null> {
  return ((await getBackend().get(META_STORE, id)) as CampaignMeta | undefined) ?? null;
}

export async function loadCampaignData(id: string): Promise<{ rawData: RawDonation[]; style: SharedStyle | null; friends: FriendJar[]; raffles: Raffle[]; monobankJar: MonobankJarRef | null } | null> {
  const data = (await getBackend().get(DATA_STORE, id)) as CampaignData | undefined;
  if (!data) return null;
  return { rawData: data.rawData, style: data.style ?? null, friends: data.friends ?? [], raffles: data.raffles ?? [], monobankJar: data.monobankJar ?? null };
}

export async function deleteCampaign(id: string): Promise<void> {
  const kv = getBackend();
  await kv.remove(DATA_STORE, id);
  await kv.remove(META_STORE, id);
}

// ─── Backup ───────────────────────────────────────────────────────────────────

const BACKUP_FORMAT = 'zbory-backup';
const BACKUP_VERSION = 1;

/** Every project with everything saved for it. The Monobank token is not part of a project, so it never gets in here. */
export interface ProjectBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  projects: Array<{ meta: CampaignMeta; data: CampaignData }>;
  /** «Мої дружні банки»; missing in backups made before they existed */
  ownJars?: OwnJar[];
}

export async function buildBackup(now: number = Date.now()): Promise<ProjectBackup> {
  const kv = getBackend();
  const metas = await listCampaigns();
  const projects: ProjectBackup['projects'] = [];
  for (const meta of metas) {
    const data = (await kv.get(DATA_STORE, meta.id)) as CampaignData | undefined;
    if (data) projects.push({ meta, data });
  }
  const ownJars = await listOwnJars();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, projects, ...(ownJars.length ? { ownJars } : null) };
}

const isRow = (r: unknown) => {
  const row = r as RawDonation | null;
  return typeof row?.date === 'string' && typeof row.amount === 'string';
};

/** Reads a backup file's text; null if it is not a backup this version of the app can use. */
export function parseBackup(text: string): ProjectBackup | null {
  let body: Partial<ProjectBackup> | null;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (body?.format !== BACKUP_FORMAT || body.version !== BACKUP_VERSION || !Array.isArray(body.projects)) return null;
  const valid = body.projects.every(
    (p) => typeof p?.meta?.id === 'string' && typeof p.meta.name === 'string' && typeof p.meta.updatedAt === 'number' && Array.isArray(p.data?.rawData) && p.data.rawData.every(isRow),
  );
  if (!valid || (body.ownJars !== undefined && !(Array.isArray(body.ownJars) && body.ownJars.every(isOwnJar)))) return null;
  return body as ProjectBackup;
}

export interface RestoreResult {
  added: number;
  updated: number;
  /** already here, in the same or a newer state */
  kept: number;
  /** friendly jars brought in (added or updated) */
  ownJars: number;
}

/** Brings a backup in without losing anything newer: a project the device doesn't have is added, and one
 * it has is replaced only if the backup's copy was saved later. */
export async function restoreBackup(backup: ProjectBackup): Promise<RestoreResult> {
  const kv = getBackend();
  const result: RestoreResult = { added: 0, updated: 0, kept: 0, ownJars: 0 };
  for (const { meta, data } of backup.projects) {
    const existing = (await kv.get(META_STORE, meta.id)) as CampaignMeta | undefined;
    if (existing && existing.updatedAt >= meta.updatedAt) {
      result.kept += 1;
      continue;
    }
    await kv.put(DATA_STORE, { ...data, id: meta.id });
    // the list's numbers are worked out from the rows, not taken from the file
    await kv.put(META_STORE, { ...meta, summary: computeCampaignSummary(data.rawData) });
    result[existing ? 'updated' : 'added'] += 1;
  }
  if (backup.ownJars?.length) {
    const jars = await restoreOwnJars(backup.ownJars);
    result.ownJars = jars.added + jars.updated;
  }
  return result;
}
