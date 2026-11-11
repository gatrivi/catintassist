/**
 * Session notes = ONE call's notes (v4.209.0).
 *
 * Rule: notes written during a call never carry into the next call.
 * Before: they were cleared only by the 15 s HIPAA grace finalizer, which
 *  - is CANCELLED when the next call starts inside those 15 s (always-on ear), and
 *  - never runs on the "keep transcript visible" end path.
 * Now: call end marks the notes as "belong to an ended call"; the next call
 * start clears them. Notes typed off-call AFTER a clear survive into the call.
 */

export const NOTES_KEY = 'catintassist_notes';
export const NOTES_TRASH_PREFIX = 'catintassist_notes_trash:';
export const NOTES_CLEARED_EVENT = 'catint_notes_cleared';

/** Move live notes to a timestamped trash key (purged end of day), empty the pad. */
export const archiveAndClearNotes = () => {
  try {
    const live = localStorage.getItem(NOTES_KEY) || '';
    if (live.trim()) localStorage.setItem(`${NOTES_TRASH_PREFIX}${new Date().toISOString()}`, live);
    localStorage.setItem(NOTES_KEY, '');
    window.dispatchEvent(new CustomEvent(NOTES_CLEARED_EVENT));
  } catch (e) {
    // storage blocked: nothing to clear
  }
};
