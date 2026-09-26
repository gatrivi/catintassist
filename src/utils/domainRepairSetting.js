/**
 * Domain-repair switch (v4.155.0) — OFF by default.
 *
 * When OFF, the transcript is exactly what Deepgram said (today's behaviour,
 * unchanged). When ON, known medical/legal mishearings are corrected on the way
 * to the screen (see src/utils/domainLexicon.js).
 *
 * It ships OFF on purpose: the repair is a guess about a clinical word, and the
 * operator should switch it on deliberately and watch the first few calls.
 * Flip it in Settings -> Transcription. A phone number or a dose is never
 * touched by it (that is enforced in the lexicon, not here).
 */
export const DOMAIN_REPAIR_STORAGE_KEY = 'catint_domain_repair_v1';
export const DOMAIN_REPAIR_CHANGED_EVENT = 'catint_domain_repair_changed';

export const isDomainRepairEnabled = () => {
  try {
    return localStorage.getItem(DOMAIN_REPAIR_STORAGE_KEY) === '1';
  } catch {
    return false; // no storage = no repair (safe default)
  }
};

export const setDomainRepairEnabled = (on) => {
  const next = !!on;
  try {
    localStorage.setItem(DOMAIN_REPAIR_STORAGE_KEY, next ? '1' : '0');
  } catch {
    return next;
  }
  try {
    window.dispatchEvent(new CustomEvent(DOMAIN_REPAIR_CHANGED_EVENT, { detail: next }));
  } catch (_) {
    /* no window (tests) — the value is still saved */
  }
  return next;
};

export const toggleDomainRepair = () => setDomainRepairEnabled(!isDomainRepairEnabled());
