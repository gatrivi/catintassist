import { useState, useCallback, useRef, useEffect } from 'react';

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
  const [engineStatus, setEngineStatus] = useState('idle'); // 'idle' | 'translating' | 'buffering' | 'ready'
  const lastPrefetchedTextRef = useRef('');

  const targetLang = lang === 'en' ? 'es' : 'en';

  const sanitizeTranslation = (input) => {
    if (!input || typeof input !== 'string') return '';
    const upper = input.toUpperCase();
    // Catch common 'error' or 'limit' responses from scrapers/apis
    if (upper.includes('MYMEMORY') || 
        upper.includes('LIMIT') || 
        upper.includes('THROTTLED') || 
        upper.includes('FORBIDDEN') ||
        upper.includes('QUOTA') ||
        input.includes('<html>') ||
        input.length < 1
    ) return '';
    return input.trim();
  };

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation(''); setAudioUrl(null); setEngineStatus('idle'); return;
    }

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      setEngineStatus('translating');
      const langPair = `${lang}-${targetLang}`;
      const cached = getCached(text, langPair);
      
      if (cached) { 
        setTranslation(cached); 
        setIsTranslating(false); 
        setEngineStatus('ready');
        if (shouldPrefetch && typeof prefetchTTS === 'function') {
          setEngineStatus('buffering');
          const url = await prefetchTTS(cached, targetLang);
          setAudioUrl(url);
          setEngineStatus('ready');
          lastPrefetchedTextRef.current = cached;
        }
        return; 
      }

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
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); return d.translations?.[0]?.text;
        },
        ms: async (c) => {
          if (!keys.MS) throw 'no key';
          const r = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${lang}&to=${targetLang}`, {
            method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': keys.MS, 'Ocp-Apim-Subscription-Region': keys.MS_REG, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ Text: c }])
          });
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); return d[0]?.translations?.[0]?.text;
        },
        openai: async (c) => {
          if (!keys.OPENAI) throw 'no key';
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${keys.OPENAI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "system", content: `Translate from ${lang} to ${targetLang}. Return ONLY the direct translation.` }, { role: "user", content: c }],
              temperature: 0
            })
          });
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); return d.choices?.[0]?.message?.content;
        },
        google: async (c) => {
          const r = await fetch(`https://translate.googleapis.com/translate_a/t?client=te&v=1.0&sl=${lang}&tl=${targetLang}&q=${encodeURIComponent(c)}`);
          if (!r.ok) throw `status ${r.status}`;
          const d = await r.json(); 
          if (Array.isArray(d)) return d.map(p => typeof p === 'string' ? p : (p[0] || '')).join(' ');
          return String(d);
        },
        google_gtx: async (c) => {
          const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(c)}`);
          if (!r.ok) throw `gtx ${r.status}`;
          const d = await r.json(); 
          if (!d?.[0]) return '';
          return d[0].map(s => s[0]).filter(Boolean).join('');
        },
        lingva: async (c) => {
          const r = await fetch(`https://lingva.ml/api/v1/${lang}/${targetLang}/${encodeURIComponent(c)}`);
          if (!r.ok) throw `lingva ${r.status}`;
          const d = await r.json(); return d.translation;
        }
      };

      const raceChunk = async (chunk) => {
        const pool = [];
        // Add paid services if keys exist
        if (keys.DEEPL) pool.push({ id: 'deepl', fn: fetchers.deepl, delay: 0 });
        if (keys.OPENAI) pool.push({ id: 'openai', fn: fetchers.openai, delay: 300 });
        if (keys.MS) pool.push({ id: 'ms', fn: fetchers.ms, delay: 600 });
        
        // Add free fallbacks with very aggressive timing
        pool.push({ id: 'google_gtx', fn: fetchers.google_gtx, delay: 0 });
        pool.push({ id: 'google', fn: fetchers.google, delay: 400 });
        pool.push({ id: 'lingva', fn: fetchers.lingva, delay: 800 });

        let resolved = false;
        return new Promise((resolve) => {
          const timeouts = [];
          
          pool.forEach((service, idx) => {
            const tout = setTimeout(async () => {
              if (resolved) return;
              try {
                const res = await service.fn(chunk);
                const clean = sanitizeTranslation(String(res));
                if (clean && !resolved) {
                  resolved = true;
                  timeouts.forEach(clearTimeout);
                  console.log(`[Trans] Winner: ${service.id}`);
                  resolve(clean.trim());
                }
              } catch (e) {
                // Fail silent, wait for others or absolute timeout
              }
            }, service.delay);
            timeouts.push(tout);
          });

          // Absolute safety timeout: return original text after 5s
          setTimeout(() => { 
            if (!resolved) {
              resolved = true;
              timeouts.forEach(clearTimeout);
              console.warn(`[Trans] All failed/timed out, returning original.`);
              resolve(chunk.trim()); 
            }
          }, 5000); 
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
      const final = results.join(' ').trim();
      setTranslation(final);
      setCached(text, langPair, final);
      setIsTranslating(false);
      setEngineStatus('ready');

      if (shouldPrefetch && final && final !== lastPrefetchedTextRef.current && typeof prefetchTTS === 'function') {
        setEngineStatus('buffering');
        const url = await prefetchTTS(final, targetLang);
        setAudioUrl(url);
        setEngineStatus('ready');
        lastPrefetchedTextRef.current = final;
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [text, lang, targetLang, prefetchTTS, shouldPrefetch]);

  return { translation, audioUrl, isTranslating, engineStatus, targetLang };
};


