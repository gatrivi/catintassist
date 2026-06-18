let runtimeDeepgramKey = null;

const REMEMBER_KEY = 'dg_remember_key';
const REMEMBER_UNTIL = 'dg_remember_until';
const SESSION_KEY = 'dg_session_key';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getRuntimeDeepgramKey = () => runtimeDeepgramKey;

export const isValidDeepgramApiKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (!k) return false;
  if (k === 'your_deepgram_api_key_here') return false;
  if (k.length < 10) return false;
  return true;
};

export const isRememberExpired = () => {
  try {
    const until = Number(localStorage.getItem(REMEMBER_UNTIL) || 0);
    return until > 0 && Date.now() >= until;
  } catch {
    return false;
  }
};

export const rememberDeepgramKey = (key) => {
  const k = (key || '').trim();
  if (!isValidDeepgramApiKey(k)) return;
  try {
    localStorage.setItem(REMEMBER_KEY, k);
    localStorage.setItem(REMEMBER_UNTIL, String(Date.now() + THIRTY_DAYS_MS));
    sessionStorage.setItem(SESSION_KEY, k);
  } catch (_) {}
  runtimeDeepgramKey = k;
  try {
    window.dispatchEvent(new Event('cat_deepgram_runtime_key_changed'));
  } catch (_) {}
};

export const clearRememberedKey = () => {
  try {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(REMEMBER_UNTIL);
    sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}
  runtimeDeepgramKey = null;
  try {
    window.dispatchEvent(new Event('cat_deepgram_runtime_key_changed'));
  } catch (_) {}
};

export const restoreRememberedKey = () => {
  try {
    const until = Number(localStorage.getItem(REMEMBER_UNTIL) || 0);
    if (until && Date.now() >= until) {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(REMEMBER_UNTIL);
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    const k =
      (until && Date.now() < until ? localStorage.getItem(REMEMBER_KEY) : null) ||
      sessionStorage.getItem(SESSION_KEY);
    if (isValidDeepgramApiKey(k)) {
      runtimeDeepgramKey = k.trim();
      return true;
    }
  } catch (_) {}
  return false;
};

export const setRuntimeDeepgramKey = (key) => {
  if (key && isValidDeepgramApiKey(key)) {
    rememberDeepgramKey(key);
    return;
  }
  if (!key) {
    clearRememberedKey();
    return;
  }
  runtimeDeepgramKey = key || null;
  try {
    window.dispatchEvent(new Event('cat_deepgram_runtime_key_changed'));
  } catch (_) {}
};

restoreRememberedKey();
