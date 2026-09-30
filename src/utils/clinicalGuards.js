/**
 * Clinical guards — the two transcription safety switches (v4.155.0 / v4.156.0).
 *
 * Both default OFF, and that is the whole design: an unfixed pipeline must
 * behave EXACTLY like the version before it. The operator switches a guard on
 * deliberately and watches a call before trusting it.
 *
 *   Term repair    rewrites KNOWN medical/legal mishearings ("all but a roll"
 *                  -> albuterol). Never touches a digit. See utils/domainLexicon.js
 *   Negation guard READ-ONLY. Marks a line whose negation looks dropped. Never
 *                  edits a word — see utils/negationGuard.js
 *
 * They are deliberately separate switches: the guard is read-only (a warning),
 * the repair is a rewrite. One must never be hidden behind the other.
 *
 * In Settings -> Deepgram. A phone number or a dose is never touched by
 * either one — that is enforced in the lexicon, not here.
 */

/** Small helper so both switches behave identically (and fail safe). */
const makeGuard = ({ key, changedEvent, label }) => ({
  storageKey: key,
  changedEvent,
  label,
  read() {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false; // no storage = guard off (safe default)
    }
  },
  write(on) {
    const next = !!on;
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      return next;
    }
    try {
      window.dispatchEvent(new CustomEvent(changedEvent, { detail: next }));
    } catch (_) {
      /* no window (tests) — the value is still saved */
    }
    return next;
  },
  toggle() {
    return this.write(!this.read());
  },
});

export const DOMAIN_REPAIR = makeGuard({
  key: 'catint_domain_repair_v1',
  changedEvent: 'catint_domain_repair_changed',
  label: 'Term repair',
});

export const NEGATION_GUARD = makeGuard({
  key: 'catint_negation_guard_v1',
  changedEvent: 'catint_negation_guard_changed',
  label: 'Negation guard',
});

export const DOMAIN_REPAIR_STORAGE_KEY = DOMAIN_REPAIR.storageKey;
export const DOMAIN_REPAIR_CHANGED_EVENT = DOMAIN_REPAIR.changedEvent;
export const NEGATION_GUARD_STORAGE_KEY = NEGATION_GUARD.storageKey;
export const NEGATION_GUARD_CHANGED_EVENT = NEGATION_GUARD.changedEvent;

export const isDomainRepairEnabled = () => DOMAIN_REPAIR.read();
export const setDomainRepairEnabled = (on) => DOMAIN_REPAIR.write(on);
export const toggleDomainRepair = () => DOMAIN_REPAIR.toggle();

export const isNegationGuardEnabled = () => NEGATION_GUARD.read();
export const setNegationGuardEnabled = (on) => NEGATION_GUARD.write(on);
export const toggleNegationGuard = () => NEGATION_GUARD.toggle();

// ---------------------------------------------------------------------------
// v4.173.0 — DIGIT REWRITES: the panic button.
//
// A cost call went wrong because the display pipeline turned spoken prices
// into clock times and SSNs (see utils/sensitiveDataProtector.js §MONEY FOLD).
// Those rewrites are worth having — they are what makes a phone number
// readable — but on a money call they are a liability, and the operator is
// the one who knows which kind of call they are on.
//
// ON  (default): full pipeline, as v4.172.0 plus the money fix.
// OFF: no number-word conversion, no magnitude/time folds, no digit stitch,
//      no phone/SSN grouping. The transcript shows exactly what Deepgram
//      said. Highlighting and click-to-copy of numbers still work — they are
//      read-only, they never rewrite.
//
// Deliberately NOT inverted: a missing key means ON, because a bad default
// here shows wrong numbers, and wrong numbers cost real money.
// ---------------------------------------------------------------------------

const DIGIT_REWRITES_KEY = 'catint_digit_rewrites_v1';

export const isDigitRewritesEnabled = () => {
  try {
    return localStorage.getItem(DIGIT_REWRITES_KEY) !== '0';
  } catch {
    return true; // no storage = full pipeline (safe, matches the shipped default)
  }
};

export const setDigitRewritesEnabled = (on) => {
  const next = on !== false;
  try {
    localStorage.setItem(DIGIT_REWRITES_KEY, next ? '1' : '0');
  } catch {
    return next;
  }
  try {
    window.dispatchEvent(new CustomEvent('catint_digit_rewrites_changed', { detail: next }));
  } catch (_) {
    /* no window (tests) — the value is still saved */
  }
  return next;
};

export const DIGIT_REWRITES_STORAGE_KEY = DIGIT_REWRITES_KEY;
export const DIGIT_REWRITES_CHANGED_EVENT = 'catint_digit_rewrites_changed';

