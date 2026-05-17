// Tiny IndexedDB wrapper for the self-review feature.
//
// Stores webcam clips locally so the dancer can replay themselves alongside
// the source video. Nothing here ever leaves the device.
//
// Schema:
//   db   = "mimi-self-review"  v1
//   store = "recordings" keyed by string UUID
//   index "byVideoAndCreated" on [videoId, createdAt] (lets us page per-video)
//
// Each row is { id, videoId, createdAt, durationSec, thumbDataUrl, mime, blob }.
// listRecordings() never reads the blob — it returns metadata only so the UI
// can render a thumbnail strip without paying for the full clip download.

const DB_NAME = 'mimi-self-review';
const DB_VERSION = 1;
const STORE = 'recordings';
const INDEX = 'byVideoAndCreated';

export type RecordingMeta = {
  id: string;
  videoId: number;
  createdAt: number;
  durationSec: number;
  thumbDataUrl: string;
  mime: string;
};

type RecordingRow = RecordingMeta & { blob: Blob };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex(INDEX, ['videoId', 'createdAt'], { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('Failed to open self-review DB'));
    req.onblocked = () => reject(new Error('Self-review DB blocked by another tab'));
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function friendlyQuotaError(err: unknown): Error {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: string }).name;
    if (name === 'QuotaExceededError') {
      return new Error('Storage full — delete old clips before recording more.');
    }
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function addRecording(
  videoId: number,
  blob: Blob,
  durationSec: number,
  thumbDataUrl: string
): Promise<{ id: string; createdAt: number }> {
  const db = await openDb();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const row: RecordingRow = {
    id,
    videoId,
    createdAt,
    durationSec,
    thumbDataUrl,
    mime: blob.type,
    blob
  };
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.oncomplete = () => resolve();
    t.onabort = () => reject(friendlyQuotaError(t.error));
    t.onerror = () => reject(friendlyQuotaError(t.error));
    try {
      t.objectStore(STORE).add(row);
    } catch (err) {
      reject(friendlyQuotaError(err));
    }
  });
  return { id, createdAt };
}

export async function listRecordings(videoId: number): Promise<RecordingMeta[]> {
  const db = await openDb();
  return new Promise<RecordingMeta[]>((resolve, reject) => {
    const store = tx(db, 'readonly');
    const idx = store.index(INDEX);
    const range = IDBKeyRange.bound([videoId, -Infinity], [videoId, Infinity]);
    const out: RecordingMeta[] = [];
    const req = idx.openCursor(range, 'prev'); // newest first
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      const v = cursor.value as RecordingRow;
      out.push({
        id: v.id,
        videoId: v.videoId,
        createdAt: v.createdAt,
        durationSec: v.durationSec,
        thumbDataUrl: v.thumbDataUrl,
        mime: v.mime
      });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecording(id: string): Promise<{ blob: Blob } | null> {
  const db = await openDb();
  const row = await reqToPromise(tx(db, 'readonly').get(id));
  if (!row) return null;
  return { blob: (row as RecordingRow).blob };
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  await reqToPromise(tx(db, 'readwrite').delete(id));
}

export async function pruneOldest(videoId: number, maxKeep: number): Promise<number> {
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const idx = store.index(INDEX);
    const range = IDBKeyRange.bound([videoId, -Infinity], [videoId, Infinity]);
    // Walk newest-first and delete anything beyond the keep window.
    const req = idx.openCursor(range, 'prev');
    let seen = 0;
    let deleted = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(deleted);
        return;
      }
      seen += 1;
      if (seen > maxKeep) {
        cursor.delete();
        deleted += 1;
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
