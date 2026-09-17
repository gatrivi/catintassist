import { set as idbSet, get as idbGet, del as idbDel } from 'idb-keyval';

// Last-call transcript seal (v4.130.1): STOP wipes the live transcript, but a
// read-only copy of the finished call survives until the next call starts,
// End Day, or explicit 🗑 clear. Update reloads / DG reconnects never seal.
export const LAST_CALL_ARCHIVE_KEY = 'catint_last_call_v1';
const MAX_ARCHIVE_CAPTIONS = 500;

export const isSealableArchive = (captions) =>
  Array.isArray(captions) && captions.some((c) => c && String(c.text || '').trim());

export const buildLastCallArchive = (captions) => ({
  endedAt: Date.now(),
  captions: (Array.isArray(captions) ? captions : [])
    .filter((c) => c && String(c.text || '').trim())
    .slice(-MAX_ARCHIVE_CAPTIONS),
});

export const saveLastCallArchive = async (captions) => {
  if (!isSealableArchive(captions)) return false;
  try {
    await idbSet(LAST_CALL_ARCHIVE_KEY, buildLastCallArchive(captions));
    return true;
  } catch (_) {
    return false;
  }
};

export const loadLastCallArchive = async () => {
  try {
    const saved = await idbGet(LAST_CALL_ARCHIVE_KEY);
    if (!saved || !Array.isArray(saved.captions) || saved.captions.length === 0) return null;
    return saved;
  } catch (_) {
    return null;
  }
};

export const clearLastCallArchive = async () => {
  try {
    await idbDel(LAST_CALL_ARCHIVE_KEY);
  } catch (_) {}
};
