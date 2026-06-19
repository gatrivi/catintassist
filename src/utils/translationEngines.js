/** Ordered translation engine chain with rate-limit fallback — v4.54.0 */

import { isTranslationPassthrough } from './translationQuality';

const BLACKBOX = {};
const BLACKBOX_TTL = 86400000; // 24h
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

export const isEngineBlocked = (id) => {
  if (BLACKBOX[id] && Date.now() - BLACKBOX[id] < BLACKBOX_TTL) return true;
  const session = readSessionBlacklist();
  const until = session[id];
  return until && Date.now() < until;
};

export const blacklistEngine = (id, ttlMs = BLACKBOX_TTL) => {
  BLACKBOX[id] = Date.now();
  const session = readSessionBlacklist();
  session[id] = Date.now() + ttlMs;
  writeSessionBlacklist(session);
};

export const isRateLimitError = (err, body = '') => {
  const s = `${err?.message || err || ''} ${body}`.toUpperCase();
  return (
    s.includes('429') ||
    s.includes('403') ||
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
  if (isRateLimitError(err)) return 'rate_limit';
  if (isBrowserFetchError(err)) return 'cors_or_network';
  if (`${err?.message || ''}`.includes('timeout')) return 'timeout';
  return 'error';
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

export const getTranslationKeyStatus = () => {
  let deepl = false;
  let openai = false;
  try {
    deepl = !!localStorage.getItem('DEEPL_API_KEY');
    openai = !!localStorage.getItem('OPENAI_API_KEY');
  } catch (_) {}
  return { deepl, openai };
};

export const getTranslationEngineHealth = () => {
  const keys = getTranslationKeyStatus();
  const chain = buildEngineChain('en', 'es', {
    DEEPL: keys.deepl ? 'x' : '',
    OPENAI: keys.openai ? 'x' : '',
  });
  const blocked = ['deepl', 'openai', 'google_gtx', 'mymemory'].filter((id) =>
    isEngineBlocked(id),
  );
  return { keys, chain, blocked, lastAttempt: lastTranslationAttempt };
};

const buildFetchers = (sLang, tLang, keys, signal) => ({
  deepl: async (text) => {
    if (!keys.DEEPL) throw new Error('no key');
    const r = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `DeepL-Auth-Key ${keys.DEEPL}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text,
        target_lang: tLang.toUpperCase(),
        source_lang: sLang.toUpperCase(),
      }),
    });
    if (!r.ok) throw new Error(`deepl ${r.status}`);
    const d = await r.json();
    return d.translations?.[0]?.text;
  },
  openai: async (text) => {
    if (!keys.OPENAI) throw new Error('no key');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${keys.OPENAI}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Translate from ${sLang} to ${tLang}. Return ONLY the direct translation.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
      }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content;
  },
  google_gtx: async (text) => {
    const r = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sLang}&tl=${tLang}&dt=t&q=${encodeURIComponent(text)}`,
      { signal },
    );
    if (!r.ok) throw new Error(`gtx ${r.status}`);
    const d = await r.json();
    return (
      d?.[0]
        ?.map((s) => s[0])
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() || ''
    );
  },
  mymemory: async (text) => {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sLang}|${tLang}`,
      { signal },
    );
    if (!r.ok) throw new Error(`mymemory ${r.status}`);
    const d = await r.json();
    return d?.responseData?.translatedText;
  },
});

/** Browser-safe chain — lingva removed (CORS blocked on custom domains). */
export const buildEngineChain = (sLang, tLang, keys) => {
  const chain = [];
  if (keys.DEEPL) chain.push('deepl');
  if (keys.OPENAI) chain.push('openai');
  chain.push('google_gtx', 'mymemory');
  return chain.filter((id) => !isEngineBlocked(id));
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
  const chain = buildEngineChain(sLang, tLang, keys);
  const failures = [];
  const tried = [];
  const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;
  let lastWeak = null;

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

      const accepted = acceptFn ? acceptFn(text, clean, sLang, tLang) : clean;
      if (accepted) {
        const result = { text: accepted, engineId: id, quality: 'ok', failures, tried };
        lastTranslationAttempt = result;
        return result;
      }

      const passthrough = isTranslationPassthrough(text, clean, sLang, tLang);
      if (passthrough && isLast && wordCount <= 4 && clean.length >= 1) {
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
      if (isRateLimitError(e) || isBrowserFetchError(e)) {
        blacklistEngine(id);
      }
    }
  }

  if (lastWeak) {
    lastTranslationAttempt = lastWeak;
    return lastWeak;
  }

  const result = { ...FAILED, failures, tried };
  lastTranslationAttempt = result;
  return result;
};
