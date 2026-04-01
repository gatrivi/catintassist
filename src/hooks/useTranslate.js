import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for translation with triple-layered fallback and error filtering.
 * Designed to be resilient against free API throttling and "ugly" error messages.
 */
export const useTranslate = (text, lang, prefetchTTS, shouldPrefetch) => {
  const [translation, setTranslation] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const lastPrefetchedTextRef = useRef('');

  const targetLang = lang === 'en' ? 'es' : 'en';

  // Helper to filter out known API error messages or warnings
  const sanitizeTranslation = (input) => {
    if (!input) return '';
    const upper = input.toUpperCase();
    if (upper.includes('MYMEMORY WARNING') || 
        upper.includes('USAGE LIMIT') || 
        upper.includes('THROTTLED') || 
        upper.includes('403 FORBIDDEN') ||
        upper.includes('TOO MANY REQUESTS') ||
        input.includes('<html>')) {
      return ''; // Return empty string to show "..." instead of horrible errors
    }
    return input;
  };

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation('');
      setAudioUrl(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      
      // Layer 1: Google Translate (at client)
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=at&sl=${lang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Primary failed');
        const json = await res.json();
        const result = json[0].map(x => x[0]).join('');
        const sanitized = sanitizeTranslation(result);
        
        if (sanitized) {
          setTranslation(sanitized);
          setIsTranslating(false);
          if (shouldPrefetch && sanitized !== lastPrefetchedTextRef.current) {
            const urlObj = await prefetchTTS(sanitized, targetLang);
            setAudioUrl(urlObj);
            lastPrefetchedTextRef.current = sanitized;
          }
          return;
        }
        throw new Error('Sanitized out');
      } catch (err) {
        // Layer 2: Lingva Translate (Stable Proxy)
        try {
          const lingvaUrl = `https://lingva.ml/api/v1/${lang}/${targetLang}/${encodeURIComponent(text)}`;
          const res = await fetch(lingvaUrl);
          const json = await res.json();
          const sanitized = sanitizeTranslation(json.translation);
          
          if (sanitized) {
            setTranslation(sanitized);
            setIsTranslating(false);
            if (shouldPrefetch && sanitized !== lastPrefetchedTextRef.current) {
              const urlObj = await prefetchTTS(sanitized, targetLang);
              setAudioUrl(urlObj);
              lastPrefetchedTextRef.current = sanitized;
            }
            return;
          }
        } catch (err2) {
          // Layer 3: MyMemory (Last Resort)
          try {
            const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${lang}|${targetLang}`;
            const res = await fetch(myMemoryUrl);
            const json = await res.json();
            const sanitized = sanitizeTranslation(json.responseData?.translatedText);
            
            if (sanitized) {
              setTranslation(sanitized);
              setIsTranslating(false);
              if (shouldPrefetch && sanitized !== lastPrefetchedTextRef.current) {
                const urlObj = await prefetchTTS(sanitized, targetLang);
                setAudioUrl(urlObj);
                lastPrefetchedTextRef.current = sanitized;
              }
              return;
            }
          } catch (err3) {
            console.error("All translation layers failed.");
          }
        }
      }
      
      setTranslation(''); // Clear if all failed
      setIsTranslating(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [text, lang, targetLang, prefetchTTS, shouldPrefetch]);

  return { translation, audioUrl, isTranslating, targetLang };
};
