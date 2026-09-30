// Shared local-storage backend for the app's persisted libraries (campaigns,
// themes): a tiny key/value abstraction over IndexedDB, with an in-memory
// fallback for environments where IndexedDB is unavailable (private
// browsing, node tests) — the app keeps working, records just don't survive
// the tab.

const DB_NAME = 'zbory-campaigns';
const DB_VERSION = 2;
// Every object store any domain module needs, created up front on upgrade —
// keeping this list in one place means a version bump only has to happen
// when a store is added, not per domain.
const STORE_NAMES = ['meta', 'data', 'themes'];

export interface KVBackend {
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
        for (const store of STORE_NAMES) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
        }
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

export function getBackend(): KVBackend {
  backend ??= typeof indexedDB === 'undefined' ? memoryBackend() : idbBackend();
  return backend;
}
