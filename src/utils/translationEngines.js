/** Ordered translation engine chain with rate-limit fallback — v4.73.1 */

import { getTranslationApiKeys, getTranslationKeyStatus } from './translationRuntimeKeys';

const DEFAULT_AZURE_REGION = 'brazilsouth';

const BLACKBOX = {};
const BLACKBOX_TTL = 86400000; // 24h
const BLACKBOX_TTLS = {};
const BLACKBOX_REASONS = {};
const SESSION_BLACKLIST_KEY = 'catint_trans_engine_blacklist_v1';
const LOGGED_FAILS = new Set();

let lastTranslationAttempt = null;

export const getLastTranslationAttempt = () => lastTranslationAttempt;

const readSessionBlacklist = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_BLACKLIST_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeSessionBlacklist = (map) => {
  try {
    sessionStorage.setItem(SESSION_BLACKLIST_KEY, JSON.stringify(map));
  } catch (_) {}
};

const sessionEntryUntil = (entry) => {
  if (!entry) return 0;
  if (typeof entry === 'number') return entry;
  return entry.until || 0;
};

export const isEngineBlocked = (id) => {
  const memTtl = BLACKBOX_TTLS[id] || BLACKBOX_TTL;
  if (BLACKBOX[id] && Date.now() - BLACKBOX[id] < memTtl) return true;
  const session = readSessionBlacklist();
  const until = sessionEntryUntil(session[id]);
  return until > Date.now();
};

const LOCAL_TRANSLATE_ENGINE = 'local_stt';
const GATEWAY_ENGINE = 'gateway';
const FREE_ENGINE_BLACKLIST_MS = 10 * 60 * 1000; // 10m — network blips
const RATE_LIMIT_BLACKLIST_MS = 30 * 60 * 1000; // 30m — don't hammer 429 APIs

export const blacklistEngine = (id, ttlMs, reason = 'error') => {
  const rateLimited = reason === 'rate_limit';
  const effectiveTtl =
    ttlMs ??
    (rateLimited
      ? RATE_LIMIT_BLACKLIST_MS
      : id === LOCAL_TRANSLATE_ENGINE
        ? FREE_ENGINE_BLACKLIST_MS
        : BLACKBOX_TTL);
  BLACKBOX[id] = Date.now();
  BLACKBOX_TTLS[id] = effectiveTtl;
  BLACKBOX_REASONS[id] = reason;
  const session = readSessionBlacklist();
  session[id] = { until: Date.now() + effectiveTtl, reason };
  writeSessionBlacklist(session);
};

/** Clear only transient blocks (network blips) — keep rate_limit cooldowns. */
export const clearTransientEngineBlacklist = () => {
  const session = readSessionBlacklist();
  Object.keys(session).forEach((id) => {
    const entry = session[id];
    const reason = typeof entry === 'object' ? entry.reason : 'error';
    if (reason === 'rate_limit') return;
    delete session[id];
    delete BLACKBOX[id];
    delete BLACKBOX_TTLS[id];
    delete BLACKBOX_REASONS[id];
  });
  writeSessionBlacklist(session);
};

export const clearSessionEngineBlacklist = () => {
  try {
    sessionStorage.removeItem(SESSION_BLACKLIST_KEY);
  } catch (_) {}
  Object.keys(BLACKBOX).forEach((k) => delete BLACKBOX[k]);
  Object.keys(BLACKBOX_TTLS).forEach((k) => delete BLACKBOX_TTLS[k]);
  Object.keys(BLACKBOX_REASONS).forEach((k) => delete BLACKBOX_REASONS[k]);
  lastAzureOutcome = null;
};

/** Auth failures — do not treat as rate limit (403 can be key/region mismatch). */
export const isUnauthorizedError = (err, body = '') => {
  const s = `${err?.message || err || ''} ${body}`.toUpperCase();
  return (
    /\b401\b/.test(s) ||
    /\b403\b/.test(s) ||
    s.includes('UNAUTHORIZED') ||
    s.includes('AUTHENTICATION') ||
    s.includes('ACCESS DENIED')
  );
};

export const isRateLimitError = (err, body = '') => {
  if (isUnauthorizedError(err, body)) return false;
  const s = `${err?.message || err || ''} ${body}`.toUpperCase();
  return (
    s.includes('429') ||
    s.includes('LIMIT') ||
    s.includes('THROTTLED') ||
    s.includes('QUOTA') ||
    s.includes('MYMEMORY WARNING')
  );
};

export const isBrowserFetchError = (err) => {
  const s = `${err?.message || err || ''}`.toLowerCase();
  return (
    s.includes('failed to fetch') ||
    s.includes('networkerror') ||
    s.includes('network error') ||
    s.includes('load failed') ||
    s.includes('cors')
  );
};

export const classifyEngineFailure = (err) => {
  if (isUnauthorizedError(err)) return 'unauthorized';
  if (isRateLimitError(err)) return 'rate_limit';
  if (isBrowserFetchError(err)) return 'cors_or_network';
  if (`${err?.message || ''}`.includes('timeout')) return 'timeout';
  return 'error';
};

/** Last Azure outcome only — never stores keys, bodies, or translated text. */
let lastAzureOutcome = null; // { status: 'ok'|'unauthorized'|'error', at: number }

export const getLastAzureOutcome = () => lastAzureOutcome;

/**
 * Visible Azure line for Settings / Phase 0.
 * "ok" only after a successful Azure request — key presence alone is never ok.
 */
export const getAzureStatusLabel = () => {
  const keys = getTranslationKeyStatus();
  if (!keys.azure) return 'Azure: missing key';
  if (isEngineBlocked('azure')) {
    const session = readSessionBlacklist();
    const entry = session.azure;
    const reason =
      (typeof entry === 'object' && entry?.reason) ||
      BLACKBOX_REASONS.azure ||
      lastAzureOutcome?.status;
    if (reason === 'unauthorized' || lastAzureOutcome?.status === 'unauthorized') {
      return 'Azure: unauthorized / key-region mismatch';
    }
    return 'Azure: paused';
  }
  if (lastAzureOutcome?.status === 'ok') return 'Azure: ok';
  if (lastAzureOutcome?.status === 'unauthorized') {
    return 'Azure: unauthorized / key-region mismatch';
  }
  if (lastAzureOutcome?.status === 'error') return 'Azure: error';
  return 'Azure: key configured (unverified)';
};

export const isAzureFallbackOnly = () => {
  const keys = getTranslationKeyStatus();
  if (!keys.azure) return false;
  if (lastAzureOutcome?.status === 'unauthorized') return true;
  if (!isEngineBlocked('azure')) return false;
  const session = readSessionBlacklist();
  const entry = session.azure;
  const reason = (typeof entry === 'object' && entry?.reason) || BLACKBOX_REASONS.azure;
  return reason === 'unauthorized' || lastAzureOutcome?.status === 'unauthorized';
};

const logEngineFailOnce = (id, reason) => {
  const key = `${id}:${reason}`;
  if (LOGGED_FAILS.has(key)) return;
  LOGGED_FAILS.add(key);
};

export const sanitizeEngineResponse = (input) => {
  if (!input || typeof input !== 'string') return '';
  const upper = input.toUpperCase();
  if (
    upper.includes('MYMEMORY') ||
    upper.includes('LIMIT') ||
    upper.includes('THROTTLED') ||
    upper.includes('FORBIDDEN') ||
    upper.includes('QUOTA') ||
    input.includes('<html>')
  ) {
    return '';
  }
  return input.trim();
};

export { getTranslationKeyStatus } from './translationRuntimeKeys';

export const getTranslationEngineHealth = () => {
  const keys = getTranslationKeyStatus();
  const apiKeys = getTranslationApiKeys();
  const chain = buildEngineChain('en', 'es', apiKeys);
  const blocked = [LOCAL_TRANSLATE_ENGINE, GATEWAY_ENGINE].filter((id) =>
    isEngineBlocked(id),
  );
  return {
    keys,
    chain,
    blocked,
    lastAttempt: lastTranslationAttempt,
    azureStatus: getAzureStatusLabel(),
    azureFallbackOnly: isAzureFallbackOnly(),
    azureRegion: apiKeys.AZURE_REGION || DEFAULT_AZURE_REGION,
  };
};

/**
 * Browser boundary: translation traffic may only reach our own gateway.
 * Never add a provider URL here: it leaks keys, produces CORS noise, and
 * makes every caption compete with a provider from the call tab.
 */
const buildFetchers = (sLang, tLang, keys, signal) => ({
  [LOCAL_TRANSLATE_ENGINE]: async (text) => {
    const r = await fetch('http://127.0.0.1:59200/stt/translate', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from_lang: sLang, to_lang: tLang }),
    });
    if (!r.ok) throw new Error(`local translator ${r.status}`);
    return (await r.json())?.text || '';
  },
  [GATEWAY_ENGINE]: async (text) => {
    const r = await fetch('/api/translate', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang: sLang, targetLang: tLang }),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    return (await r.json())?.translation || '';
  },
});

/** Browser-safe chain — lingva removed (CORS blocked on custom domains). */
export const buildEngineChain = (sLang, tLang, keys, { forceFree = false } = {}) => {
  // Local model first; server fallback second. Neither browser request calls a
  // third-party provider, so Azure/Google cannot create DevTools noise.
  const candidates = forceFree
    ? [LOCAL_TRANSLATE_ENGINE]
    : [LOCAL_TRANSLATE_ENGINE, GATEWAY_ENGINE];
  return candidates.filter((id) => !isEngineBlocked(id));
};

const FAILED = { text: '', engineId: null, quality: 'failed', failures: [], tried: [] };

export const translateWithFallback = async ({
  text,
  sLang,
  tLang,
  keys,
  signal,
  acceptFn,
  onEngineFail,
  timeoutMs = 4000,
}) => {
  const fetchers = buildFetchers(sLang, tLang, keys, signal);
  let chain = buildEngineChain(sLang, tLang, keys);
  // All engines paused — retry only transient (non-429) blocks on free tier.
  if (chain.length === 0) {
    clearTransientEngineBlacklist();
    chain = buildEngineChain(sLang, tLang, keys, { forceFree: true });
  }
  const failures = [];
  const tried = [];
  let lastWeak = null;
  let lastAnyClean = null;

  for (let i = 0; i < chain.length; i += 1) {
    const id = chain[i];
    const isLast = i === chain.length - 1;
    if (signal?.aborted) {
      lastTranslationAttempt = { tried, failures, engineId: null, quality: 'failed' };
      return FAILED;
    }
    tried.push(id);
    try {
      const timer = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), timeoutMs),
      );
      const raw = await Promise.race([fetchers[id](text), timer]);
      const clean = sanitizeEngineResponse(String(raw || ''));
      if (!clean) continue;
      lastAnyClean = { text: clean, engineId: id };

      const accepted = acceptFn ? acceptFn(text, clean, sLang, tLang) : clean;
      if (accepted) {
        const result = { text: accepted, engineId: id, quality: 'ok', failures, tried };
        lastTranslationAttempt = result;
        return result;
      }

      // Poor translation beats none — last engine keeps whatever it returned.
      if (isLast && clean.length >= 1) {
        lastWeak = { text: clean, engineId: id, quality: 'weak', failures, tried };
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        lastTranslationAttempt = { tried, failures, engineId: null, quality: 'failed' };
        return FAILED;
      }
      const reason = classifyEngineFailure(e);
      failures.push({ id, reason });
      logEngineFailOnce(id, reason);
      onEngineFail?.(id, reason);
      if (
        isRateLimitError(e) ||
        isBrowserFetchError(e) ||
        reason === 'unauthorized'
      ) {
        blacklistEngine(id, undefined, reason);
      }
    }
  }

  if (lastWeak) {
    lastTranslationAttempt = lastWeak;
    return lastWeak;
  }

  if (lastAnyClean?.text) {
    const fallback = {
      text: lastAnyClean.text,
      engineId: lastAnyClean.engineId,
      quality: 'weak',
      failures,
      tried,
    };
    lastTranslationAttempt = fallback;
    return fallback;
  }

  const result = { ...FAILED, failures, tried };
  lastTranslationAttempt = result;
  return result;
};
