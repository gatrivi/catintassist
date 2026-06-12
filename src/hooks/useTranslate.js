import { useState, useRef, useEffect } from 'react';

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

export const useTranslate = (text, lang, prefetchTTS, shouldPrefetch, mood = 'default', forceTranslateKey = 0) => {
  const [translation, setTranslation] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [engineStatus, setEngineStatus] = useState('idle');
  
  // STICKY LANGUAGE PAIR: Once a bubble has a translation, we lock the source/target 
  // to prevent Deepgram flip-flops from destroying the work.
  const langPairRef = useRef(null);
  
  const lastPrefetchedTextRef = useRef('');
  const lastTranslatedTextRef = useRef('');
  const lastWordCountRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const sourceLang = (lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const targetLang = sourceLang === 'en' ? 'es' : 'en';
  const currentLangPair = `${sourceLang}-${targetLang}`;

  const sanitizeTranslation = (input) => {
    if (!input || typeof input !== 'string') return '';
    const upper = input.toUpperCase();
    const isError = upper.includes('MYMEMORY') || upper.includes('LIMIT') || upper.includes('THROTTLED') || upper.includes('FORBIDDEN') || upper.includes('QUOTA') || upper.includes('ABORT') || input.includes('<html>');
    return isError ? '' : input.trim();
  };

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation(''); setAudioUrl(null); setEngineStatus('idle'); return;
    }

    const t = () => new Date().toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    
    // NORMALIZE TEXT for comparison
    const normText = text.trim().replace(/\s+/g, ' ');
    const wordCount = normText.split(/\s+/).length;
    const force = forceTranslateKey > 0;

    // Manual retrigger: break sticky pairing + prevent "delta skip".
    if (force) {
      langPairRef.current = null;
      lastTranslatedTextRef.current = '';
      lastWordCountRef.current = 0;
    }

    // POLICY CHECK: Skip if too long, too short, or just noise/filler
    const wordDelta = Math.abs(wordCount - lastWordCountRef.current);
    const IS_FILLER = /^bueno[.,!?]*$/i.test(normText) && wordDelta < 2 && lastTranslatedTextRef.current;
    const IS_TOO_LONG = wordCount > 80; 
    const IS_TOO_SHORT = normText.length < 2 && !/\d/.test(normText);

    if (IS_TOO_LONG || IS_FILLER || IS_TOO_SHORT) {
      setEngineStatus(IS_TOO_LONG ? 'ready' : 'idle');
      if (IS_TOO_LONG) setTranslation(`(Text too long for direct translation [v4.32.0])`);
      return;
    }

    // SAFETY VALVE: Only translate if significant words added (except in FAST mood)
    const hasPunctuation = /[.,?]/.test(normText);
    const forceTrigger = wordCount >= 10 || hasPunctuation;

    const isNoise = normText.length < 3 && !/\w/.test(normText);
    if (isNoise) return;

    const shouldSkipDueToDelta = mood !== 'fast' && 
                                 wordDelta < 2 && 
                                 !force && 
                                 !forceTrigger && 
                                 lastTranslatedTextRef.current;
    
    if (shouldSkipDueToDelta) return;

    // DEBOUNCE based on MOOD
    const debounceTimes = { fast: 300, default: 600, chill: 1000 };
    const waitTime = forceTrigger ? 200 : (debounceTimes[mood] || 600);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      // Lock lang pair on first success
      const langPair = langPairRef.current || currentLangPair;
      const [sLang, tLang] = langPair.split('-');

      console.log(`[${t()}] [v4.32.0] Translating ${langPair} (${wordCount}w): "${normText.substring(0, 30)}..."`);

      setIsTranslating(true);
      setEngineStatus('translating');

      const segmentRegex = /([^.,!?]+[.,!?]+\s*)/g;
      const stableMatches = normText.match(segmentRegex) || [];
      const validSegments = stableMatches.filter(s => s.trim().length > 1);
      const segmentsToTranslate = validSegments.length > 0 ? validSegments : [normText];
      const activeText = normText.replace(segmentRegex, '').trim();
      
      const results = [];
      
      const raceChunk = async (chunk) => {
        const norm = chunk.trim().replace(/\s+/g, ' ');
        const cached = getCached(norm, langPair);
        if (cached) return cached;

        const keys = {
          DEEPL: localStorage.getItem('DEEPL_API_KEY'),
          OPENAI: localStorage.getItem('OPENAI_API_KEY')
        };

        const fetchers = {
          deepl: async (c) => {
            if (!keys.DEEPL) throw new Error('no key');
            const r = await fetch(`https://api-free.deepl.com/v2/translate`, {
              method: 'POST', signal, headers: { 'Authorization': `DeepL-Auth-Key ${keys.DEEPL}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ text: c, target_lang: tLang.toUpperCase(), source_lang: sLang.toUpperCase() })
            });
            if (!r.ok) throw new Error(`status ${r.status}`);
            const d = await r.json(); return d.translations?.[0]?.text;
          },
          openai: async (c) => {
            if (!keys.OPENAI) throw new Error('no key');
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST', signal, headers: { 'Authorization': `Bearer ${keys.OPENAI}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: `Translate from ${sLang} to ${tLang}. Return ONLY the direct translation.` }, { role: "user", content: c }],
                temperature: 0
              })
            });
            if (!r.ok) throw new Error(`status ${r.status}`);
            const d = await r.json(); return d.choices?.[0]?.message?.content;
          },
          google_gtx: async (c) => {
            const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sLang}&tl=${tLang}&dt=t&q=${encodeURIComponent(c)}`, { signal });
            if (!r.ok) throw new Error(`gtx ${r.status}`);
            const d = await r.json(); 
            return d?.[0]?.map(s => s[0]).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || '';
          }
        };

        const pool = [];
        const isBlocked = (id) => BLACKBOX[id] && (Date.now() - BLACKBOX[id] < 300000);

        if (keys.DEEPL) pool.push({ id: 'deepl', fn: fetchers.deepl, delay: 0 });
        if (keys.OPENAI) pool.push({ id: 'openai', fn: fetchers.openai, delay: 100 });
        if (!isBlocked('google_gtx')) pool.push({ id: 'google_gtx', fn: fetchers.google_gtx, delay: 0 });

        if (pool.length === 0) return '';

        let resolved = false;
        return new Promise((resolve) => {
          const timeouts = [];
          pool.forEach((service) => {
            const tout = setTimeout(async () => {
              if (resolved || signal.aborted) return;
              try {
                const res = await service.fn(norm);
                const clean = sanitizeTranslation(String(res));
                if (clean && !resolved && !signal.aborted) {
                  resolved = true;
                  timeouts.forEach(clearTimeout);
                  setCached(norm, langPair, clean);
                  resolve(clean.trim());
                }
              } catch (e) {
                if (e.name === 'AbortError') return;
                BLACKBOX[service.id] = Date.now();
              }
            }, service.delay);
            timeouts.push(tout);
          });
          setTimeout(() => { if (!resolved && !signal.aborted) { resolved = true; resolve(''); } }, 2500); 
        });
      };

      try {
        for (const segment of segmentsToTranslate) {
          if (signal.aborted) return;
          const res = await raceChunk(segment);
          if (res) results.push(res);
        }
        if (activeText && activeText.length > 1 && !signal.aborted && validSegments.length > 0) {
          const res = await raceChunk(activeText);
          if (res) results.push(res);
        }

        if (signal.aborted) return;

        const final = results.join(' ').replace(/\s+/g, ' ').trim();
        if (final && final.length > 2) {
          // Successful translation: Lock the lang pair
          if (!langPairRef.current) langPairRef.current = langPair;
          
          setTranslation(final);
          lastTranslatedTextRef.current = normText;
          lastWordCountRef.current = wordCount;

          if (shouldPrefetch && typeof prefetchTTS === 'function') {
            const url = await prefetchTTS(final, tLang);
            setAudioUrl(url);
            lastPrefetchedTextRef.current = final;
          }
        } else if (!signal.aborted) {
          setTranslation(`[${normText}]`);
          lastTranslatedTextRef.current = normText;
          lastWordCountRef.current = wordCount;
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error('[Trans] Catch:', e);
      } finally {
        if (!signal.aborted) {
          setIsTranslating(false);
          setEngineStatus('ready');
        }
      }
    }, waitTime);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [text, lang, shouldPrefetch, prefetchTTS, currentLangPair, mood, forceTranslateKey]);

  return { translation, audioUrl, isTranslating, engineStatus, targetLang: (langPairRef.current || currentLangPair).split('-')[1] };
};

