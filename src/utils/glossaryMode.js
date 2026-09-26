/**
 * Glossary mode (v4.161.0) — the operator's call, changeable at any moment.
 *
 *   off     ignore pinned translations entirely (the pre-glossary behaviour)
 *   exact   today's behaviour: a pin only fires on that exact source sentence
 *   phrase  a pinned TERM is applied inside every future sentence (v4.161.0)
 *
 * Defaults to `exact` so nothing changes for anyone who already pins wording,
 * and phrase mode is one click away for the calls where sentence-exact is
 * too much work — CSA and other legal work, where the same term comes back
 * every time in a different sentence.
 */
export const GLOSSARY_MODES = ['off', 'exact', 'phrase'];

export const GLOSSARY_MODE_STORAGE_KEY = 'catint_glossary_mode_v1';
export const GLOSSARY_MODE_CHANGED_EVENT = 'catint_glossary_mode_changed';

export const loadGlossaryMode = () => {
  try {
    const raw = localStorage.getItem(GLOSSARY_MODE_STORAGE_KEY);
    return GLOSSARY_MODES.includes(raw) ? raw : 'exact';
  } catch {
    return 'exact';
  }
};

export const saveGlossaryMode = (mode) => {
  const next = GLOSSARY_MODES.includes(mode) ? mode : 'exact';
  try {
    localStorage.setItem(GLOSSARY_MODE_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(GLOSSARY_MODE_CHANGED_EVENT, { detail: next }));
  } catch {
    /* no storage / no window: the session runs on the default */
  }
  return next;
};

export const cycleGlossaryMode = () => {
  const order = GLOSSARY_MODES;
  const next = order[(order.indexOf(loadGlossaryMode()) + 1) % order.length];
  return saveGlossaryMode(next);
};

export const GLOSSARY_MODE_LABELS = {
  off: 'OFF',
  exact: 'EXACT',
  phrase: 'PHRASE',
};

export const GLOSSARY_MODE_HINTS = {
  off: 'Pinned translations are ignored.',
  exact: 'A pin fires only on that exact sentence.',
  phrase: 'A pinned term is applied inside every future sentence.',
};
