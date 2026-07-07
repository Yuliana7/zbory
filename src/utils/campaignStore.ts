import type { RawDonation } from '../types';
import { normalizeDonations } from './csvParser';
import { generateId } from './id';

// Campaign library: named datasets persisted in IndexedDB so volunteers can
// keep every jar they've run and (later) merge files and compare campaigns.
// Meta and row data live in separate object stores — listing the library must
// not deserialize thousands of rows per campaign.
//
// When IndexedDB is unavailable (private browsing, node tests) everything
// falls back to an in-memory backend: the app keeps working, campaigns just
// don't survive the tab.

const DB_NAME = 'zbory-campaigns';
const DB_VERSION = 1;
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
  createdAt: number;
  updatedAt: number;
  summary: CampaignSummary;
}

interface CampaignData {
  id: string;
  rawData: RawDonation[];
}

// ─── Storage backend ──────────────────────────────────────────────────────────

interface KVBackend {
  get(store: string, key: string): Promise<unknown>;
  getAll(store: string): Promise<unknown[]>;
  put<T extends { id: string }>(store: string, value: T): Promise<void>;
  remove(store: string, key: string): Promise<void>;
}

function memoryBackend(): KVBackend {
  const stores = new Map<string, Map<string, { id: string }>>();
  const table = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  return {
    get: async (store, key) => table(store).get(key),
    getAll: async (store) => [...table(store).values()],
    put: async (store, value) => void table(store).set(value.id, value),
    remove: async (store, key) => void table(store).delete(key),
  };
}

function idbBackend(): KVBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const openDb = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };

  const request = async <T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  };

  return {
    get: (store, key) => request(store, 'readonly', (s) => s.get(key)),
    getAll: (store) => request(store, 'readonly', (s) => s.getAll()),
    put: async (store, value) => void (await request(store, 'readwrite', (s) => s.put(value))),
    remove: async (store, key) => void (await request(store, 'readwrite', (s) => s.delete(key))),
  };
}

let backend: KVBackend | null = null;

function getBackend(): KVBackend {
  backend ??= typeof indexedDB === 'undefined' ? memoryBackend() : idbBackend();
  return backend;
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
}

export async function saveCampaign(input: SaveCampaignInput): Promise<CampaignMeta> {
  const kv = getBackend();
  const now = Date.now();
  const existing = input.id ? ((await kv.get(META_STORE, input.id)) as CampaignMeta | undefined) : undefined;

  const meta: CampaignMeta = {
    id: existing?.id ?? input.id ?? generateId(),
    name: input.name.trim(),
    fileName: input.fileName,
    goal: input.goal,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    summary: computeCampaignSummary(input.rawData),
  };

  await kv.put(DATA_STORE, { id: meta.id, rawData: input.rawData } satisfies CampaignData);
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

export async function loadCampaignData(id: string): Promise<RawDonation[] | null> {
  const data = (await getBackend().get(DATA_STORE, id)) as CampaignData | undefined;
  return data?.rawData ?? null;
}

export async function deleteCampaign(id: string): Promise<void> {
  const kv = getBackend();
  await kv.remove(DATA_STORE, id);
  await kv.remove(META_STORE, id);
}
