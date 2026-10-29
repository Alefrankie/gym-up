// Minimal promise wrapper over IndexedDB (no dependency). One database, three stores:
//   outbox  commands waiting to reach the server, ordered by an auto-increment `seq`
//   failed  commands the server rejected (4xx), kept so the user can retry or discard them
//   kv      key/value: cached GET responses (`cache:*`) and live workout snapshots (`session:*`)

const DB_NAME = 'gymup';
const DB_VERSION = 1;

export type StoreName = 'outbox' | 'failed' | 'kv';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      db.createObjectStore('failed', { keyPath: 'seq' });
      db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: IDBValidKey) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  getAll: <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  getAllKeys: (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
  count: (store: StoreName) => run<number>(store, 'readonly', (s) => s.count()),
  /** `key` is required for the out-of-line `kv` store and ignored for the keyPath stores. */
  put: (store: StoreName, value: unknown, key?: IDBValidKey) =>
    run(store, 'readwrite', (s) => (store === 'kv' ? s.put(value, key) : s.put(value))),
  /** Appends to a keyPath store with an auto-increment key; resolves with the new key. */
  add: (store: StoreName, value: unknown) => run<IDBValidKey>(store, 'readwrite', (s) => s.add(value)),
  delete: (store: StoreName, key: IDBValidKey) => run(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: StoreName) => run(store, 'readwrite', (s) => s.clear()),
};

// ---- kv helpers -----------------------------------------------------------

export const kv = {
  get: <T>(key: string) => idb.get<T>('kv', key),
  set: (key: string, value: unknown) => idb.put('kv', value, key),
  delete: (key: string) => idb.delete('kv', key),
  async keys(prefix: string): Promise<string[]> {
    return (await idb.getAllKeys('kv')).filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
  },
};
