import { useState, useRef, useEffect } from 'react';
import {
  isTranslationPassthrough,
  splitTranslatableSegments,
  isIncrementalTranscriptGrowth,
  isSentenceComplete,
} from '../utils/translationQuality';
import { translateWithFallback } from '../utils/translationEngines';
import { dedupeInFlight, withTranslationSlot } from '../utils/translationRequestQueue';
import { APP_VERSION } from '../constants/version';

let TRANS_CACHE = {};

const MAX_MEM_CACHE = 500;
const MAX_STORAGE_CACHE = 1000;

const pruneStorage = () => {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('trans_cache:'));
    if (keys.length > MAX_STORAGE_CACHE) keys.forEach((k) => localStorage.removeItem(k));
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
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('trans_cache:'))
        .forEach((k) => localStorage.removeItem(k));
      try {
        localStorage.setItem(`trans_cache:${langPair}:${norm}`, result);
      } catch (err) {}
    }
  }
};

const acceptTranslation = (source, result, sLang, tLang) => {
  const clean = (result || '').trim();
  if (!clean || clean.length < 1) return '';
  if (isTranslationPassthrough(source, clean, sLang, tLang)) return '';
  return clean;
};

const emptyMeta = {
  engineId: null,
  quality: 'idle',
  failures: [],
  tried: [],
};

export const useTranslate = (
  text,
  lang,
  prefetchTTS,
  shouldPrefetch,
  mood = 'auto',
  forceTranslateKey = 0,
  { isFinal = true } = {},
) => {
  const [translation, setTranslation] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [engineStatus, setEngineStatus] = useState('idle');
  const [translationMeta, setTranslationMeta] = useState(emptyMeta);

  const langPairRef = useRef(null);
  const prevTextRef = useRef('');
  const lastTranslatedTextRef = useRef('');
  const lastWordCountRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const hasGoodTranslationRef = useRef(false);

  const sourceLang = (lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const targetLang = sourceLang === 'en' ? 'es' : 'en';
  const currentLangPair = `${sourceLang}-${targetLang}`;

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation('');
      setAudioUrl(null);
      setEngineStatus('idle');
      setTranslationMeta(emptyMeta);
      prevTextRef.current = '';
      return;
    }

    const normText = text.trim().replace(/\s+/g, ' ');
    const wordCount = normText.split(/\s+/).length;
    const force = forceTranslateKey > 0;

    const isSplitRewrite =
      prevTextRef.current && !isIncrementalTranscriptGrowth(prevTextRef.current, normText);

    if (isSplitRewrite) {
      lastTranslatedTextRef.current = '';
      lastWordCountRef.current = 0;
      hasGoodTranslationRef.current = false;
      // Bubble split: drop stale translation from the longer pre-split text.
      setTranslation('');
      setAudioUrl(null);
      setTranslationMeta(emptyMeta);
    }
    prevTextRef.current = normText;

    if (force) {
      langPairRef.current = null;
      lastTranslatedTextRef.current = '';
      lastWordCountRef.current = 0;
    }

    if (mood === 'auto') {
      const sealed = isFinal !== false;
      const complete = isSentenceComplete(normText);
      if (!sealed && !complete) return;
      if (normText === lastTranslatedTextRef.current && hasGoodTranslationRef.current) return;
    }

    const wordDelta = Math.abs(wordCount - lastWordCountRef.current);
    const IS_FILLER =
      /^bueno[.,!?]*$/i.test(normText) && wordDelta < 2 && lastTranslatedTextRef.current;
    const IS_TOO_LONG = wordCount > 80;
    const IS_TOO_SHORT = normText.length < 2 && !/\d/.test(normText);

    if (IS_TOO_LONG || IS_FILLER || IS_TOO_SHORT) {
      setEngineStatus(IS_TOO_LONG ? 'ready' : 'idle');
      if (IS_TOO_LONG) setTranslation(`(Text too long for direct translation [v${APP_VERSION}])`);
      return;
    }

    const hasPunctuation = /[.,?]/.test(normText);
    const forceTrigger = mood === 'auto' ? isSentenceComplete(normText) : wordCount >= 10 || hasPunctuation;

    if (normText.length < 3 && !/\w/.test(normText)) return;

    const shouldSkipDueToDelta =
      mood !== 'fast' &&
      mood !== 'auto' &&
      wordDelta < 2 &&
      !force &&
      !forceTrigger &&
      lastTranslatedTextRef.current;

    if (shouldSkipDueToDelta) return;

    const debounceTimes = { auto: 800, fast: 300, default: 600, chill: 1000 };
    const waitTime = forceTrigger ? (mood === 'auto' ? 800 : 200) : debounceTimes[mood] || 600;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      const langPair = langPairRef.current || currentLangPair;
      const [sLang, tLang] = langPair.split('-');

      setIsTranslating(true);
      setEngineStatus('translating');

      const keys = {
        DEEPL: localStorage.getItem('DEEPL_API_KEY'),
        OPENAI: localStorage.getItem('OPENAI_API_KEY'),
      };

      const fetchChunk = async (chunk) => {
        const norm = chunk.trim().replace(/\s+/g, ' ');
        const cached = getCached(norm, langPair);
        if (cached) {
          const accepted = acceptTranslation(norm, cached, sLang, tLang);
          if (accepted) {
            return { text: accepted, engineId: 'cache', quality: 'ok', failures: [], tried: ['cache'] };
          }
        }

        const cacheKey = `${langPair}:${norm}`;
        return dedupeInFlight(cacheKey, () =>
          withTranslationSlot(async () => {
            const res = await translateWithFallback({
              text: norm,
              sLang,
              tLang,
              keys,
              signal,
              acceptFn: acceptTranslation,
            });
            if (res.text) setCached(norm, langPair, res.text);
            return res;
          }),
        );
      };

      const translateSegments = async (segments) => {
        const results = [];
        let lastMeta = emptyMeta;
        for (const segment of segments) {
          if (signal.aborted) return { text: '', meta: lastMeta };
          const res = await fetchChunk(segment);
          lastMeta = {
            engineId: res.engineId,
            quality: res.quality,
            failures: res.failures || [],
            tried: res.tried || [],
          };
          if (!res.text) return { text: '', meta: lastMeta };
          results.push(res.text);
        }
        return {
          text: results.join(' ').replace(/\s+/g, ' ').trim(),
          meta: lastMeta,
        };
      };

      try {
        const segments = splitTranslatableSegments(normText);
        let { text: final, meta } = await translateSegments(segments);

        if (
          mood !== 'auto' &&
          (!final || isTranslationPassthrough(normText, final, sLang, tLang)) &&
          segments.length > 1 &&
          !signal.aborted
        ) {
          const res = await fetchChunk(normText);
          final = res.text;
          meta = {
            engineId: res.engineId,
            quality: res.quality,
            failures: res.failures || [],
            tried: res.tried || [],
          };
        }

        if (signal.aborted) return;

        setTranslationMeta(meta);

        const passthrough = final && isTranslationPassthrough(normText, final, sLang, tLang);
        const acceptable =
          final &&
          final.length >= 1 &&
          (!passthrough || meta.quality === 'weak');

        if (acceptable) {
          if (!langPairRef.current) langPairRef.current = langPair;
          setTranslation(final);
          hasGoodTranslationRef.current = meta.quality === 'ok' || meta.quality === 'weak';
          lastTranslatedTextRef.current = normText;
          lastWordCountRef.current = wordCount;

          if (shouldPrefetch && typeof prefetchTTS === 'function') {
            const url = await prefetchTTS(final, tLang);
            setAudioUrl(url);
          }
        } else if (!signal.aborted) {
          if (!lastTranslatedTextRef.current || lastTranslatedTextRef.current !== normText) {
            setTranslation('');
            hasGoodTranslationRef.current = false;
          }
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
  }, [text, lang, shouldPrefetch, prefetchTTS, currentLangPair, mood, forceTranslateKey, isFinal]);

  return {
    translation,
    audioUrl,
    isTranslating,
    engineStatus,
    translationMeta,
    targetLang: (langPairRef.current || currentLangPair).split('-')[1],
  };
};
