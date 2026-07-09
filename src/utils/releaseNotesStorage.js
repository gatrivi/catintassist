/** Persist release-notes modal prefs (show later / don't show again / seen). */

export const SEEN_VERSION_KEY = 'catint_release_seen_version_v1';
export const DISMISS_FOREVER_ID_KEY = 'catint_release_dismiss_forever_id_v1';
export const SNOOZE_UNTIL_KEY = 'catint_release_snooze_until_v1';
export const LANG_PREF_KEY = 'catint_release_lang_pref_v1';

/** Default snooze: 24h */
export const RELEASE_NOTES_SNOOZE_MS = 24 * 60 * 60 * 1000;

export const readSeenReleaseVersion = (storage = localStorage) => {
  try {
    return storage?.getItem(SEEN_VERSION_KEY) || '';
  } catch {
    return '';
  }
};

export const writeSeenReleaseVersion = (version, storage = localStorage) => {
  try {
    storage?.setItem(SEEN_VERSION_KEY, version || '');
  } catch (_) {}
};

export const readDismissForeverId = (storage = localStorage) => {
  try {
    return storage?.getItem(DISMISS_FOREVER_ID_KEY) || '';
  } catch {
    return '';
  }
};

export const writeDismissForeverId = (noteId, storage = localStorage) => {
  try {
    storage?.setItem(DISMISS_FOREVER_ID_KEY, noteId || '');
  } catch (_) {}
};

export const readSnoozeUntil = (storage = localStorage) => {
  try {
    const raw = storage?.getItem(SNOOZE_UNTIL_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

export const writeSnoozeUntil = (epochMs, storage = localStorage) => {
  try {
    storage?.setItem(SNOOZE_UNTIL_KEY, String(epochMs || 0));
  } catch (_) {}
};

export const readReleaseNotesLangPref = (storage = localStorage) => {
  try {
    const v = storage?.getItem(LANG_PREF_KEY);
    return v === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
};

export const writeReleaseNotesLangPref = (lang, storage = localStorage) => {
  try {
    storage?.setItem(LANG_PREF_KEY, lang === 'en' ? 'en' : 'es');
  } catch (_) {}
};

/**
 * @param {{ version: string, id: string }} note
 * @param {{ now?: number, storage?: Storage }} [opts]
 */
export const shouldShowReleaseNotes = (note, opts = {}) => {
  if (!note?.version || !note?.id) return false;
  const storage = opts.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!storage) return false;

  const now = opts.now ?? Date.now();

  if (readDismissForeverId(storage) === note.id) return false;

  const snoozeUntil = readSnoozeUntil(storage);
  if (snoozeUntil > now) return false;

  const seen = readSeenReleaseVersion(storage);
  if (seen === note.version) return false;

  return true;
};

export const markReleaseNotesSeen = (version, storage = localStorage) => {
  writeSeenReleaseVersion(version, storage);
  writeSnoozeUntil(0, storage);
};

export const snoozeReleaseNotes = (storage = localStorage, ms = RELEASE_NOTES_SNOOZE_MS) => {
  writeSnoozeUntil(Date.now() + ms, storage);
};

export const dismissReleaseNotesForever = (noteId, storage = localStorage) => {
  writeDismissForeverId(noteId, storage);
  writeSnoozeUntil(0, storage);
};
