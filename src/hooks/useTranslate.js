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
      
      const DEEPL_KEY = localStorage.getItem('DEEPL_API_KEY');
      const MS_KEY = localStorage.getItem('MICROSOFT_TRANSLATOR_KEY');
      const MS_REGION = localStorage.getItem('MICROSOFT_TRANSLATOR_REGION') || 'eastus';

      // Internal function to translate a single chunk (max 500 chars usually)
      const translateChunk = async (chunk) => {
        // Layer 1: DeepL
        if (DEEPL_KEY) {
          try {
            const res = await fetch(`https://api-free.deepl.com/v2/translate`, {
              method: 'POST',
              headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ text: chunk, target_lang: targetLang.toUpperCase(), source_lang: lang.toUpperCase() })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.translations?.[0]?.text) return data.translations[0].text;
            }
          } catch (e) {}
        }

        // Layer 2: Microsoft
        if (MS_KEY) {
          try {
            const res = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${lang}&to=${targetLang}`, {
              method: 'POST',
              headers: { 'Ocp-Apim-Subscription-Key': MS_KEY, 'Ocp-Apim-Subscription-Region': MS_REGION, 'Content-Type': 'application/json' },
              body: JSON.stringify([{ Text: chunk }])
            });
            if (res.ok) {
              const data = await res.json();
              if (data[0]?.translations?.[0]?.text) return data[0].translations[0].text;
            }
          } catch (e) {}
        }

        // Layer 3: Google (Te-Client - More stable)
        try {
          const url = `https://translate.googleapis.com/translate_a/t?client=te&v=1.0&sl=${lang}&tl=${targetLang}&q=${encodeURIComponent(chunk)}`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const result = typeof json === 'string' ? json : json[0];
            const sanitized = sanitizeTranslation(result);
            if (sanitized) return sanitized;
          }
        } catch (err) {}

        // Layer 4: Lingva (Reliable Proxy)
        try {
          const res = await fetch(`https://lingva.ml/api/v1/${lang}/${targetLang}/${encodeURIComponent(chunk)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.translation) return json.translation;
          }
        } catch (err) {}

        // Layer 5: Argos OpenTech (LibreTranslate)
        try {
          const res = await fetch(`https://translate.argosopentech.com/translate`, {
            method: 'POST',
            body: JSON.stringify({ q: chunk, source: lang, target: targetLang, format: "text" }),
            headers: { "Content-Type": "application/json" }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.translatedText) return json.translatedText;
          }
        } catch (err) {}

        // Layer 6: SimplyTranslate
        try {
          const res = await fetch(`https://simplytranslate.org/api/translate?engine=google&from=${lang}&to=${targetLang}&text=${encodeURIComponent(chunk)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.translated_text) return json.translated_text;
          }
        } catch (err) {}

        // Layer 7: MyMemory
        try {
          const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${lang}|${targetLang}`;
          const res = await fetch(myMemoryUrl);
          const json = await res.json();
          const sanitized = sanitizeTranslation(json.responseData?.translatedText);
          if (sanitized) return sanitized;
        } catch (err) {}

        return null;
      };

      // Chunking logic: Split by sentences or roughly 500 chars
      const chunks = [];
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= 500) {
          chunks.push(remaining);
          break;
        }
        // Try to find a good split point (period, comma, or space)
        let splitIdx = remaining.lastIndexOf('. ', 500);
        if (splitIdx === -1) splitIdx = remaining.lastIndexOf(', ', 500);
        if (splitIdx === -1) splitIdx = remaining.lastIndexOf(' ', 500);
        if (splitIdx === -1) splitIdx = 500;
        
        chunks.push(remaining.substring(0, splitIdx + 1).trim());
        remaining = remaining.substring(splitIdx + 1).trim();
      }

      try {
        const translatedParts = [];
        for (const chunk of chunks) {
           const translated = await translateChunk(chunk);
           if (translated) translatedParts.push(translated);
           else translatedParts.push("..."); // Placeholder for failed chunk
        }
        
        const finalResult = translatedParts.join(' ');
        setTranslation(finalResult);
        setIsTranslating(false);

        if (shouldPrefetch && finalResult && finalResult !== lastPrefetchedTextRef.current) {
          const urlObj = await prefetchTTS(finalResult, targetLang);
          setAudioUrl(urlObj);
          lastPrefetchedTextRef.current = finalResult;
        }
      } catch (err) {
        console.error("Chunked translation failed:", err);
        setTranslation('');
        setIsTranslating(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [text, lang, targetLang, prefetchTTS, shouldPrefetch]);

  return { translation, audioUrl, isTranslating, targetLang };
};
