import type { FriendJar, MonobankJarRef, RawDonation, SharedStyle } from '../types';
import { normalizeDonations } from './csvParser';
import { generateId } from './id';
import { getBackend } from './db';

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
  createdAt: number;
  updatedAt: number;
  summary: CampaignSummary;
}

interface CampaignData {
  id: string;
  rawData: RawDonation[];
  style?: SharedStyle;
  friends?: FriendJar[];
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
  /** Omit to keep the saved Monobank jar link */
  monobankJar?: MonobankJarRef;
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
    createdAt: existingMeta?.createdAt ?? now,
    updatedAt: now,
    summary: computeCampaignSummary(input.rawData),
  };

  await kv.put(DATA_STORE, {
    id: meta.id,
    rawData: input.rawData,
    style: input.style ?? existingData?.style,
    friends: input.friends ?? existingData?.friends,
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

export async function loadCampaignData(id: string): Promise<{ rawData: RawDonation[]; style: SharedStyle | null; friends: FriendJar[]; monobankJar: MonobankJarRef | null } | null> {
  const data = (await getBackend().get(DATA_STORE, id)) as CampaignData | undefined;
  if (!data) return null;
  return { rawData: data.rawData, style: data.style ?? null, friends: data.friends ?? [], monobankJar: data.monobankJar ?? null };
}

export async function deleteCampaign(id: string): Promise<void> {
  const kv = getBackend();
  await kv.remove(DATA_STORE, id);
  await kv.remove(META_STORE, id);
}
