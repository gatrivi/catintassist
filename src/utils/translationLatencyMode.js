/** Translation latency ladders (v4.167.0) — the operator's call, changeable live. */
export const TRANSLATION_LATENCY_MODES = ['fast', 'balanced', 'patient'];

export const TRANSLATION_LATENCY_STORAGE_KEY = 'catint_trans_latency_v1';
export const TRANSLATION_LATENCY_CHANGED_EVENT = 'catint_trans_latency_changed';

/**
 * Each ladder is [first, second, last] — the per-attempt timeout in ms.
 *
 * In live interpreting every second is a sentence you are behind, so FAST is the
 * default: 700ms on the first engine. Real engines answer in 200-900ms, so 700ms
 * only ever abandons an engine that was never going to arrive in time to be
 * useful. PATIENT is kept for when a rare segment genuinely needs patience.
 */
export const TRANSLATION_LATENCY_LADDERS = {
  fast: [700, 1200, 2000],
  balanced: [1200, 2000, 4000],
  patient: [4000, 4000, 4000],
};

export const TRANSLATION_LATENCY_LABELS = { fast: 'FAST', balanced: 'BAL', patient: 'PATIENT' };
export const TRANSLATION_LATENCY_HINTS = {
  fast: 'First engine gives up at 0.7s. Best for live interpreting.',
  balanced: 'First engine gives up at 1.2s, last keeps 4s.',
  patient: 'Every engine waits up to 4s. Slow, but never abandons a good engine.',
};

export const loadTranslationLatencyMode = () => {
  try {
    const raw = localStorage.getItem(TRANSLATION_LATENCY_STORAGE_KEY);
    return TRANSLATION_LATENCY_MODES.includes(raw) ? raw : 'fast';
  } catch {
    return 'fast';
  }
};

export const loadTranslationLatencyLadder = () =>
  TRANSLATION_LATENCY_LADDERS[loadTranslationLatencyMode()] || TRANSLATION_LATENCY_LADDERS.fast;

export const saveTranslationLatencyMode = (mode) => {
  const next = TRANSLATION_LATENCY_MODES.includes(mode) ? mode : 'fast';
  try {
    localStorage.setItem(TRANSLATION_LATENCY_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(TRANSLATION_LATENCY_CHANGED_EVENT, { detail: next }));
  } catch {
    /* no storage: the session runs on the default */
  }
  return next;
};
