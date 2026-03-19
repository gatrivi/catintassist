import { get, set, del } from 'idb-keyval';

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
    return await get(key);
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

// Helper: convert ObjectURL back to blob if needed, though we should just store the raw File/Blob.
export const generateObjectUrl = (blob) => {
  if (!blob) return null;
  return URL.createObjectURL(blob);
};
