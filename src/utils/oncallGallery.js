/**
 * v4.171.0 — which greetings the interpreter keeps in the on-call gallery.
 *
 * The gallery used to be a hardcoded seven (ON_CALL_SLOTS), so 17 of your 24
 * recorded greetings could never appear on-call. It is now a persisted,
 * ordered pick list the strip edits in place. Deliberately dependency-free:
 * the caller validates ids against ACTIONS, so no import cycle.
 */

export const GALLERY_PICKS_KEY = 'catint_oncall_gallery_v1';

/** Ceiling: the dock sits above the transcript and must never grow rows. */
export const MAX_GALLERY = 8;

/** Exactly what you saw before you had a say: the old hardcoded seven. */
export const DEFAULT_GALLERY_IDS = [
  'greeting_en',
  'greeting_es',
  'hold_exc_en',
  'hold_exc_es',
  'sign_off',
  'closer_louder',
  'intake',
];

/**
 * Drop junk, unknown ids, duplicates and anything past the ceiling, keeping
 * the order you picked. An empty result is legitimate (you emptied the row).
 */
export const normalizeGalleryPicks = (raw, isValidId = () => true) => {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const id of list) {
    if (typeof id !== 'string' || !isValidId(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
};

/**
 * The saved picks, or the original seven the first time you open the strip.
 * An explicitly saved empty list is honoured — that is you clearing the row.
 */
export const readGalleryPicks = (isValidId = () => true) => {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(GALLERY_PICKS_KEY));
  } catch {
    raw = undefined;
  }
  if (!Array.isArray(raw)) return normalizeGalleryPicks(DEFAULT_GALLERY_IDS, isValidId);
  return normalizeGalleryPicks(raw, isValidId);
};

export const writeGalleryPicks = (ids, isValidId) => {
  const picks = normalizeGalleryPicks(ids, isValidId);
  try {
    localStorage.setItem(GALLERY_PICKS_KEY, JSON.stringify(picks));
  } catch {
    /* ignore */
  }
  return picks;
};

/**
 * Add or drop one greeting. Reports `full` so the picker can explain itself
 * instead of silently ignoring the tap.
 */
export const toggleGalleryPick = (current, id, isValidId = () => true) => {
  const next = normalizeGalleryPicks(current, isValidId);
  // The id being added is validated too — a stale chip must not buy a slot.
  if (typeof id !== 'string' || !isValidId(id)) {
    return { picks: next, added: false, full: false };
  }
  if (next.includes(id)) return { picks: next.filter((p) => p !== id), added: false, full: false };
  if (next.length >= MAX_GALLERY) return { picks: next, added: false, full: true };
  return { picks: [...next, id], added: true, full: false };
};
