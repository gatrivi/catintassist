// Persistent Cache and Blacklist to save quota and skip broken services
let TRANS_CACHE = {}; 
const BLACKBOX = {}; // Stores { service_id: timestamp_of_error }

const MAX_MEM_CACHE = 500;
const MAX_STORAGE_CACHE = 1000;

const pruneStorage = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('trans_cache:'));
    if (keys.length > MAX_STORAGE_CACHE) {
      keys.forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {}
};

const getCached = (text, langPair) => {
  const norm = text.trim().replace(/\s+/g, ' ').toLowerCase();
  if (TRANS_CACHE[`${langPair}:${norm}`]) return TRANS_CACHE[`${langPair}:${norm}`];
  return localStorage.getItem(`trans_cache:${langPair}:${norm}`);
};

const setCached = (text, langPair, result) => {
  const norm = text.trim().replace(/\s+/g, ' ').toLowerCase();
  if (Object.keys(TRANS_CACHE).length > MAX_MEM_CACHE) TRANS_CACHE = {}; 
  TRANS_CACHE[`${langPair}:${norm}`] = result;
  try { 
    localStorage.setItem(`trans_cache:${langPair}:${norm}`, result); 
    if (Math.random() < 0.05) pruneStorage();
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      Object.keys(localStorage).filter(k => k.startsWith('trans_cache:')).forEach(k => localStorage.removeItem(k));
      try { localStorage.setItem(`trans_cache:${langPair}:${norm}`, result); } catch(err) {}
    }
  }
};

export const useTranslate = (text, lang, prefetchTTS, shouldPrefetch, mood = 'default') => {
  const [translation, setTranslation] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [engineStatus, setEngineStatus] = useState('idle');
  const lastPrefetchedTextRef = useRef('');
  const lastTranslatedTextRef = useRef('');
  const lastWordCountRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const sourceLang = (lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const targetLang = sourceLang === 'en' ? 'es' : 'en';

  const sanitizeTranslation = (input) => {
    if (!input || typeof input !== 'string') return '';
    const upper = input.toUpperCase();
    const isError = upper.includes('MYMEMORY') || upper.includes('LIMIT') || upper.includes('THROTTLED') || upper.includes('FORBIDDEN') || upper.includes('QUOTA') || input.includes('<html>');
    return isError ? '' : input.trim();
  };

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation(''); setAudioUrl(null); setEngineStatus('idle'); return;
    }

    // NORMALIZE TEXT for comparison
    const normText = text.trim().replace(/\s+/g, ' ');
    const wordCount = normText.split(/\s+/).length;

    // SAFETY VALVE: Only translate if significant words added (except in FAST mood)
    const wordDelta = Math.abs(wordCount - lastWordCountRef.current);
    const isPunctuationEnding = /[.!?]$/.test(normText);
    const shouldSkipDueToDelta = mood !== 'fast' && wordDelta < 3 && !isPunctuationEnding && lastTranslatedTextRef.current;
    
    if (shouldSkipDueToDelta) return;

    // DEBOUNCE based on MOOD
    const debounceTimes = { fast: 400, default: 700, chill: 1200 };
    const waitTime = debounceTimes[mood] || 700;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      // KILL Previous Request if still running
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      setIsTranslating(true);
      setEngineStatus('translating');
      const langPair = `${sourceLang}-${targetLang}`;
      const cached = getCached(normText, langPair);
      
      if (cached) { 
        setTranslation(cached); 
        setIsTranslating(false); 
        setEngineStatus('ready');
        lastTranslatedTextRef.current = normText;
        lastWordCountRef.current = wordCount;
        if (shouldPrefetch && typeof prefetchTTS === 'function') {
          const url = await prefetchTTS(cached, targetLang);
          setAudioUrl(url);
          lastPrefetchedTextRef.current = cached;
        }
        return; 
      }

      const keys = {
        DEEPL: localStorage.getItem('DEEPL_API_KEY'),
        OPENAI: localStorage.getItem('OPENAI_API_KEY')
      };

      const fetchers = {
        deepl: async (c) => {
          if (!keys.DEEPL) throw 'no key';
          const r = await fetch(`https://api-free.deepl.com/v2/translate`, {
            method: 'POST', signal, headers: { 'Authorization': `DeepL-Auth-Key ${keys.DEEPL}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ text: c, target_lang: targetLang.toUpperCase(), source_lang: sourceLang.toUpperCase() })
          });
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); return d.translations?.[0]?.text;
        },
        openai: async (c) => {
          if (!keys.OPENAI) throw 'no key';
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', signal, headers: { 'Authorization': `Bearer ${keys.OPENAI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "system", content: `Translate from ${sourceLang} to ${targetLang}. Return ONLY the direct translation.` }, { role: "user", content: c }],
              temperature: 0
            })
          });
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); return d.choices?.[0]?.message?.content;
        },
        google_gtx: async (c) => {
          const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(c)}`, { signal });
          if (!r.ok) throw `gtx ${r.status}`;
          const d = await r.json(); 
          return d?.[0]?.map(s => s[0]).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || '';
        },
        mymemory: async (c) => {
          const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=${sourceLang}|${targetLang}&de=catintassist@example.com`, { signal });
          if (!r.ok) throw `mymemory ${r.status}`;
          const d = await r.json(); 
          if (d.responseStatus !== 200) throw `mymemory err ${d.responseStatus}`;
          return d.responseData?.translatedText;
        },
        google: async (c) => {
          const r = await fetch(`https://translate.googleapis.com/translate_a/t?client=te&v=1.0&sl=${sourceLang}&tl=${targetLang}&q=${encodeURIComponent(c)}`, { signal });
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); 
          if (Array.isArray(d)) return d.map(p => typeof p === 'string' ? p : (p[0] || '')).join(' ');
          return String(d);
        }
      };

      const raceChunk = async (chunk) => {
        const pool = [];
        const isBlocked = (id) => BLACKBOX[id] && (Date.now() - BLACKBOX[id] < 300000); // 5 min ban

        if (keys.DEEPL) pool.push({ id: 'deepl', fn: fetchers.deepl, delay: 0 });
        if (keys.OPENAI) pool.push({ id: 'openai', fn: fetchers.openai, delay: 200 });
        
        if (!isBlocked('google_gtx')) pool.push({ id: 'google_gtx', fn: fetchers.google_gtx, delay: 0 });
        if (!isBlocked('mymemory')) pool.push({ id: 'mymemory', fn: fetchers.mymemory, delay: 400 });
        if (!isBlocked('google')) pool.push({ id: 'google', fn: fetchers.google, delay: 800 });

        let resolved = false;
        return new Promise((resolve) => {
          const timeouts = [];
          pool.forEach((service) => {
            const tout = setTimeout(async () => {
              if (resolved || signal.aborted) return;
              try {
                const res = await service.fn(chunk);
                const clean = sanitizeTranslation(String(res));
                if (clean && !resolved && !signal.aborted) {
                  resolved = true;
                  timeouts.forEach(clearTimeout);
                  resolve(clean.trim());
                }
              } catch (e) {
                if (e.name === 'AbortError') return;
                if (e.toString().includes('429') || e.toString().includes('403')) {
                  BLACKBOX[service.id] = Date.now();
                  console.warn(`[Trans] Service ${service.id} throttled. Blacklisting for 5m.`);
                }
              }
            }, service.delay);
            timeouts.push(tout);
          });

          setTimeout(() => { 
            if (!resolved && !signal.aborted) {
              resolved = true;
              timeouts.forEach(clearTimeout);
              resolve(chunk.trim()); 
            }
          }, 3500); 
        });
      };

      try {
        const chunks = [];
        let rem = normText;
        while (rem.length > 0) {
          if (rem.length <= 400) { chunks.push(rem); break; }
          let idx = rem.lastIndexOf('. ', 400);
          if (idx === -1) idx = rem.lastIndexOf(' ', 400);
          if (idx === -1) idx = 400;
          chunks.push(rem.substring(0, idx + 1).trim());
          rem = rem.substring(idx + 1).trim();
        }

        const results = [];
        for (const c of chunks) {
          if (signal.aborted) break;
          results.push(await raceChunk(c));
          await new Promise(res => setTimeout(res, 80)); // Stagger
        }

        if (signal.aborted) return;

        const final = results.join(' ').trim();
        if (final) {
          setTranslation(final);
          setCached(normText, langPair, final);
          lastTranslatedTextRef.current = normText;
          lastWordCountRef.current = wordCount;
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error('[Trans] Final catch:', e);
      } finally {
        if (!signal.aborted) {
          setIsTranslating(false);
          setEngineStatus('ready');
        }
      }

      if (!signal.aborted && shouldPrefetch && typeof prefetchTTS === 'function' && translation) {
        const url = await prefetchTTS(translation, targetLang);
        setAudioUrl(url);
        lastPrefetchedTextRef.current = translation;
      }
    }, waitTime);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [text, lang, shouldPrefetch, prefetchTTS, sourceLang, targetLang, mood]);

  return { translation, audioUrl, isTranslating, engineStatus, targetLang };
};

