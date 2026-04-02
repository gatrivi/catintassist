// Persistent Cache to save quota for repetitive phrases
let TRANS_CACHE = {}; 
const MAX_CACHE_SIZE = 500;

const getCached = (text, langPair) => {
  if (TRANS_CACHE[`${langPair}:${text}`]) return TRANS_CACHE[`${langPair}:${text}`];
  return localStorage.getItem(`trans_cache:${langPair}:${text}`);
};
const setCached = (text, langPair, result) => {
  // Simple check to prevent memory leak
  if (Object.keys(TRANS_CACHE).length > MAX_CACHE_SIZE) TRANS_CACHE = {}; 
  TRANS_CACHE[`${langPair}:${text}`] = result;
  try { localStorage.setItem(`trans_cache:${langPair}:${text}`, result); } catch(e) {}
};

export const useTranslate = (text, lang, prefetchTTS, shouldPrefetch) => {
  const [translation, setTranslation] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const lastPrefetchedTextRef = useRef('');

  const targetLang = lang === 'en' ? 'es' : 'en';

  const sanitizeTranslation = (input) => {
    if (!input) return '';
    const upper = input.toUpperCase();
    if (upper.includes('MYMEMORY') || upper.includes('LIMIT') || upper.includes('THROTTLED') || input.includes('<html>')) return '';
    return input.trim();
  };

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation(''); setAudioUrl(null); return;
    }

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      const langPair = `${lang}-${targetLang}`;
      const cached = getCached(text, langPair);
      if (cached) { setTranslation(cached); setIsTranslating(false); return; }

      const keys = {
        DEEPL: localStorage.getItem('DEEPL_API_KEY'),
        MS: localStorage.getItem('MICROSOFT_TRANSLATOR_KEY'),
        MS_REG: localStorage.getItem('MICROSOFT_TRANSLATOR_REGION') || 'eastus',
        OPENAI: localStorage.getItem('OPENAI_API_KEY')
      };

      const fetchers = {
        deepl: async (c) => {
          if (!keys.DEEPL) throw 'no key';
          const r = await fetch(`https://api-free.deepl.com/v2/translate`, {
            method: 'POST', headers: { 'Authorization': `DeepL-Auth-Key ${keys.DEEPL}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ text: c, target_lang: targetLang.toUpperCase(), source_lang: lang.toUpperCase() })
          });
          const d = await r.json(); return d.translations?.[0]?.text;
        },
        ms: async (c) => {
          if (!keys.MS) throw 'no key';
          const r = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${lang}&to=${targetLang}`, {
            method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': keys.MS, 'Ocp-Apim-Subscription-Region': keys.MS_REG, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ Text: c }])
          });
          const d = await r.json(); return d[0]?.translations?.[0]?.text;
        },
        openai: async (c) => {
          if (!keys.OPENAI) throw 'no key';
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${keys.OPENAI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "system", content: `Translate from ${lang} to ${targetLang}. Return ONLY the translation, no extra text.` }, { role: "user", content: c }],
              temperature: 0
            })
          });
          const d = await r.json(); return d.choices?.[0]?.message?.content;
        },
        google: async (c) => {
          const r = await fetch(`https://translate.googleapis.com/translate_a/t?client=te&v=1.0&sl=${lang}&tl=${targetLang}&q=${encodeURIComponent(c)}`);
          const d = await r.json(); return typeof d === 'string' ? d : d[0];
        },
        lingva: async (c) => {
          const r = await fetch(`https://lingva.ml/api/v1/${lang}/${targetLang}/${encodeURIComponent(c)}`);
          const d = await r.json(); return d.translation;
        }
      };

      const raceChunk = async (chunk) => {
        // We use an optimistic race: Start Primary. If no reply in 400ms, start Secondary.
        const pool = [];
        if (keys.DEEPL) pool.push(fetchers.deepl);
        if (keys.MS) pool.push(fetchers.ms);
        if (keys.OPENAI) pool.push(fetchers.openai);
        pool.push(fetchers.google, fetchers.lingva);

        let resolved = false;
        return new Promise((resolve) => {
          let attempts = 0;
          const tryNext = async (idx) => {
            if (resolved || idx >= pool.length) return;
            attempts++;
            const timeout = setTimeout(() => tryNext(idx + 1), 400); // Start next if this one drags
            try {
              const res = await pool[idx](chunk);
              const clean = sanitizeTranslation(res);
              if (clean && !resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(clean);
              } else if (!resolved) tryNext(idx + 1);
            } catch (e) { if (!resolved) tryNext(idx + 1); }
          };
          tryNext(0);
          setTimeout(() => { if(!resolved) resolve('...'); }, 5000); // Absolute safety timeout
        });
      };

      const chunks = [];
      let rem = text;
      while (rem.length > 0) {
        if (rem.length <= 450) { chunks.push(rem); break; }
        let idx = rem.lastIndexOf('. ', 450);
        if (idx === -1) idx = rem.lastIndexOf(' ', 450);
        if (idx === -1) idx = 450;
        chunks.push(rem.substring(0, idx + 1).trim());
        rem = rem.substring(idx + 1).trim();
      }

      const results = await Promise.all(chunks.map(raceChunk));
      const final = results.join(' ');
      setTranslation(final);
      setCached(text, langPair, final);
      setIsTranslating(false);

      if (shouldPrefetch && final && final !== lastPrefetchedTextRef.current) {
        const url = await prefetchTTS(final, targetLang);
        setAudioUrl(url);
        lastPrefetchedTextRef.current = final;
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [text, lang, targetLang, prefetchTTS, shouldPrefetch]);

  return { translation, audioUrl, isTranslating, targetLang };
};
