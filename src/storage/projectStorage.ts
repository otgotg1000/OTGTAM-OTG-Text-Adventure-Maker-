import { StoryProject } from '../types/story';

const DB_NAME = 'otgtam_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'library';
const LIBRARY_KEY = 'projects_library_v1';

export interface StoredLibrary {
  projects: StoryProject[];
  activeProjectId: string;
}

export interface StorageEstimateInfo {
  libraryBytes: number;
  quotaBytes: number | null;
  usageBytes: number | null;
  backend: 'indexeddb' | 'localstorage';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function loadLibraryFromIdb(): Promise<StoredLibrary | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(LIBRARY_KEY);
      req.onsuccess = () => {
        db.close();
        const val = req.result as StoredLibrary | undefined;
        if (val && Array.isArray(val.projects) && val.projects.length > 0) {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function saveLibraryToIdb(payload: StoredLibrary): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload, LIBRARY_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function estimateStorageUsage(
  projects: StoryProject[]
): Promise<StorageEstimateInfo> {
  let libraryBytes = 0;
  try {
    const serialized = JSON.stringify(projects);
    libraryBytes = new Blob([serialized]).size;
  } catch {
    libraryBytes = 0;
  }

  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      quotaBytes = typeof est.quota === 'number' ? est.quota : null;
      usageBytes = typeof est.usage === 'number' ? est.usage : null;
    } catch {
      // Ignore browser estimation issues
    }
  }

  return {
    libraryBytes,
    quotaBytes,
    usageBytes,
    backend: typeof indexedDB !== 'undefined' ? 'indexeddb' : 'localstorage',
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
