import { get, set, del, keys, entries } from 'idb-keyval';

/** Normalize values restored from IndexedDB into Blob (some browsers return plain objects). */
export const normalizeStoredBlob = (value, fallbackType = 'application/octet-stream') => {
  if (!value) return null;
  if (value instanceof Blob) return value;
  if (value instanceof ArrayBuffer) return new Blob([value], { type: fallbackType });
  if (ArrayBuffer.isView(value)) return new Blob([value], { type: fallbackType });
  if (typeof value === 'object' && value.data) {
    const data = value.data;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return new Blob([data], { type: value.type || fallbackType });
    }
  }
  return null;
};

export const saveFile = async (key, fileOrBlob) => {
  try {
    await set(key, fileOrBlob);
    return true;
  } catch (err) {
    console.error(`Failed to save ${key} to IndexedDB:`, err);
    return false;
  }
};

export const loadFile = async (key) => {
  try {
    const raw = await get(key);
    return normalizeStoredBlob(raw);
  } catch (err) {
    console.error(`Failed to load ${key} from IndexedDB:`, err);
    return null;
  }
};

export const deleteFile = async (key) => {
  try {
    await del(key);
    return true;
  } catch (err) {
    console.error(`Failed to delete ${key} from IndexedDB:`, err);
    return false;
  }
};

export const listStorageKeys = async () => {
  try {
    return await keys();
  } catch (err) {
    console.error('Failed to list IndexedDB keys:', err);
    return [];
  }
};

export const getStorageSummary = async () => {
  const allKeys = await listStorageKeys();
  const pairs = await entries();
  let bytes = 0;
  for (const [, value] of pairs) {
    const blob = normalizeStoredBlob(value);
    if (blob) bytes += blob.size;
  }
  return {
    keyCount: allKeys.length,
    keys: allKeys.map(String),
    bytes,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  };
};

export const exportStorageBackup = async () => {
  const pairs = await entries();
  const payload = { v: 1, exportedAt: new Date().toISOString(), items: {} };
  for (const [key, value] of pairs) {
    const blob = normalizeStoredBlob(value);
    if (!blob) continue;
    const buf = await blob.arrayBuffer();
    payload.items[String(key)] = {
      type: blob.type || 'application/octet-stream',
      data: Array.from(new Uint8Array(buf)),
    };
  }
  return payload;
};

export const importStorageBackup = async (payload) => {
  if (!payload?.items || typeof payload.items !== 'object') {
    throw new Error('Invalid backup file');
  }
  let count = 0;
  for (const [key, item] of Object.entries(payload.items)) {
    if (!item?.data) continue;
    const blob = new Blob([new Uint8Array(item.data)], { type: item.type || 'application/octet-stream' });
    await set(key, blob);
    count += 1;
  }
  return count;
};

export const generateObjectUrl = (blob) => {
  if (!blob) return null;
  return URL.createObjectURL(blob);
};
