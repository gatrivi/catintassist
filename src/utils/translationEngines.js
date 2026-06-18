/** Ordered translation engine chain with rate-limit fallback — v4.50.0 */

const BLACKBOX = {};
const BLACKBOX_TTL = 300000;

export const isEngineBlocked = (id) =>
  BLACKBOX[id] && Date.now() - BLACKBOX[id] < BLACKBOX_TTL;

export const blacklistEngine = (id) => {
  BLACKBOX[id] = Date.now();
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
  lingva: async (text) => {
    const r = await fetch(
      `https://lingva.ml/api/v1/${sLang}/${tLang}/${encodeURIComponent(text)}`,
      { signal },
    );
    if (!r.ok) throw new Error(`lingva ${r.status}`);
    const d = await r.json();
    return d?.translation || '';
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

export const buildEngineChain = (sLang, tLang, keys) => {
  const chain = [];
  if (keys.DEEPL) chain.push('deepl');
  if (keys.OPENAI) chain.push('openai');
  chain.push('google_gtx', 'lingva', 'mymemory');
  return chain.filter((id) => !isEngineBlocked(id));
};

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

  for (const id of chain) {
    if (signal?.aborted) return '';
    try {
      const timer = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), timeoutMs),
      );
      const raw = await Promise.race([fetchers[id](text), timer]);
      const clean = sanitizeEngineResponse(String(raw || ''));
      const accepted = acceptFn ? acceptFn(text, clean) : clean;
      if (accepted) return accepted;
    } catch (e) {
      if (e.name === 'AbortError') return '';
      if (isRateLimitError(e)) {
        blacklistEngine(id);
        onEngineFail?.(id, 'throttled');
      }
    }
  }
  return '';
};
