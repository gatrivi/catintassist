import { useState, useRef, useEffect, useCallback } from 'react';
import {
  isTranslationPassthrough,
  splitLongForTranslation,
  isIncrementalTranscriptGrowth,
  isSentenceComplete,
} from '../utils/translationQuality';
import { applySttCorrections, findGlossaryTranslation, CORRECTIONS_CHANGED_EVENT } from '../utils/transcriptCorrections';
import { translateWithFallback } from '../utils/translationEngines';
import { getTranslationApiKeys } from '../utils/translationRuntimeKeys';
import { dedupeInFlight, withTranslationSlot } from '../utils/translationRequestQueue';
import { isDevSimEnabled } from '../utils/devSimulateCaptions';
import {
  loadLanguagePair,
  normalizeLang,
  getOppositeLang,
  LANG_PAIR_CHANGED_EVENT,
} from '../utils/languageConfig';
import {
  assignSegmentIds,
  applyTranslationResult,
  buildSegmentRequestId,
  buildTranslationKey,
  composeCaptionTranslation,
  hashTranslationSource,
  shouldPersistTranslationEntry,
} from '../utils/translationApplicator';

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

/** Debounce ms for translation — 0 on bubble split so first chunk re-translates immediately. */
export function resolveTranslateDebounceMs({ isSplitRewrite, forceTrigger, mood = 'auto' }) {
  if (isSplitRewrite) return 0;
  const debounceTimes = { auto: 800, fast: 300, default: 600, chill: 1000 };
  return forceTrigger ? (mood === 'auto' ? 800 : 200) : debounceTimes[mood] || 600;
}

export const useTranslate = (
  text,
  lang,
  prefetchTTS,
  shouldPrefetch,
  mood = 'auto',
  forceTranslateKey = 0,
  {
    isFinal = true,
    mockTranslation = null,
    userTranslationOverride = null,
    captionId = null,
    persistedTranslations = null,
    onPersistTranslation = null,
  } = {},
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
  const translationsMapRef = useRef({ ...(persistedTranslations || {}) });
  const hydratedRef = useRef(false);
  const onPersistRef = useRef(onPersistTranslation);
  onPersistRef.current = onPersistTranslation;
  const [languagePair, setLanguagePair] = useState(loadLanguagePair);
  const [correctionsRev, setCorrectionsRev] = useState(0);

  useEffect(() => {
    const onCorrections = () => setCorrectionsRev((n) => n + 1);
    window.addEventListener(CORRECTIONS_CHANGED_EVENT, onCorrections);
    return () => window.removeEventListener(CORRECTIONS_CHANGED_EVENT, onCorrections);
  }, []);

  useEffect(() => {
    const onPairChange = (e) => {
      setLanguagePair(e.detail || loadLanguagePair());
      langPairRef.current = null;
    };
    window.addEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
    return () => window.removeEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
  }, []);

  // Hydrate from IDB-backed caption.translations once
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!persistedTranslations || typeof persistedTranslations !== 'object') return;
    const keys = Object.keys(persistedTranslations);
    if (!keys.length) return;
    hydratedRef.current = true;
    translationsMapRef.current = { ...persistedTranslations };
    const composed = composeCaptionTranslation(translationsMapRef.current);
    if (composed) {
      setTranslation(composed);
      setEngineStatus('ready');
      setTranslationMeta({ engineId: 'idb', quality: 'ok', failures: [], tried: ['idb'] });
      hasGoodTranslationRef.current = true;
      if (text) {
        const norm = text.trim().replace(/\s+/g, ' ');
        lastTranslatedTextRef.current = norm;
        prevTextRef.current = norm;
      }
    }
  }, [persistedTranslations, text]);

  const sourceLang = normalizeLang(lang);
  const targetLang = getOppositeLang(sourceLang, languagePair);
  const currentLangPair = `${sourceLang}-${targetLang}`;

  const persistIfSealed = useCallback(
    (entry) => {
      if (isFinal === false) return;
      if (!captionId || typeof onPersistRef.current !== 'function') return;
      if (!shouldPersistTranslationEntry(entry)) return;
      onPersistRef.current(captionId, entry);
    },
    [isFinal, captionId],
  );

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslation('');
      setAudioUrl(null);
      setEngineStatus('idle');
      setTranslationMeta(emptyMeta);
      prevTextRef.current = '';
      return;
    }

    if (
      mockTranslation != null &&
      String(mockTranslation).trim() &&
      isDevSimEnabled()
    ) {
      setTranslation(String(mockTranslation).trim());
      setEngineStatus('ready');
      setTranslationMeta({ engineId: 'dev-mock', quality: 'ok', failures: [], tried: ['dev-mock'] });
      setIsTranslating(false);
      prevTextRef.current = text.trim().replace(/\s+/g, ' ');
      lastTranslatedTextRef.current = prevTextRef.current;
      hasGoodTranslationRef.current = true;
      return;
    }

    const normText = text.trim().replace(/\s+/g, ' ');
    const wordCount = normText.split(/\s+/).length;
    const force = forceTranslateKey > 0;

    const override = (userTranslationOverride || '').trim();
    if (override) {
      setTranslation(override);
      setEngineStatus('ready');
      setTranslationMeta({ engineId: 'user', quality: 'ok', failures: [], tried: ['user-override'] });
      setIsTranslating(false);
      prevTextRef.current = normText;
      lastTranslatedTextRef.current = normText;
      hasGoodTranslationRef.current = true;
      if (isFinal !== false && captionId && typeof onPersistRef.current === 'function') {
        const sourceHash = hashTranslationSource(normText);
        const segmentId = 'seg-0';
        const key = buildTranslationKey({
          captionId,
          segmentId,
          sourceHash,
          targetLang,
        });
        onPersistRef.current(captionId, {
          key,
          captionId,
          segmentId,
          sourceHash,
          targetLang,
          text: override,
          status: 'ok',
          quality: 'ok',
          engineId: 'user',
          preserved: false,
          updatedAt: Date.now(),
        });
      }
      return;
    }

    const isSplitRewrite =
      prevTextRef.current && !isIncrementalTranscriptGrowth(prevTextRef.current, normText);

    if (isSplitRewrite) {
      lastTranslatedTextRef.current = '';
      lastWordCountRef.current = 0;
      hasGoodTranslationRef.current = false;
      // Drop composed display; keep map entries for other keys until new source hashes apply
      setTranslation('');
      setAudioUrl(null);
      setTranslationMeta(emptyMeta);
      setEngineStatus('translating');
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
      if (!sealed && !complete && !isSplitRewrite) return;
      if (normText === lastTranslatedTextRef.current && hasGoodTranslationRef.current) return;
    }

    const wordDelta = Math.abs(wordCount - lastWordCountRef.current);
    const IS_FILLER =
      !isSplitRewrite &&
      /^bueno[.,!?]*$/i.test(normText) &&
      wordDelta < 2 &&
      lastTranslatedTextRef.current;
    const IS_TOO_SHORT = normText.length < 2 && !/\d/.test(normText);

    if (IS_FILLER || IS_TOO_SHORT) {
      setEngineStatus('idle');
      return;
    }

    const hasPunctuation = /[.,?]/.test(normText);
    const forceTrigger =
      mood === 'auto'
        ? isSentenceComplete(normText) || isSplitRewrite
        : wordCount >= 10 || hasPunctuation;

    if (normText.length < 3 && !/\w/.test(normText)) return;

    const shouldSkipDueToDelta =
      !isSplitRewrite &&
      mood !== 'fast' &&
      mood !== 'auto' &&
      wordDelta < 2 &&
      !force &&
      !forceTrigger &&
      lastTranslatedTextRef.current;

    if (shouldSkipDueToDelta) return;

    const waitTime = resolveTranslateDebounceMs({ isSplitRewrite, forceTrigger, mood });

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      const langPair = langPairRef.current || currentLangPair;
      const [sLang, tLang] = langPair.split('-');
      const capId = captionId || `anon-${hashTranslationSource(normText)}`;

      const sourceForTranslate = applySttCorrections(normText, sLang);
      const glossaryHit = findGlossaryTranslation(sourceForTranslate, sLang, tLang);
      if (glossaryHit?.corrected) {
        setTranslation(glossaryHit.corrected);
        setTranslationMeta({ engineId: 'glossary', quality: 'ok', failures: [], tried: ['glossary'] });
        setIsTranslating(false);
        setEngineStatus('ready');
        hasGoodTranslationRef.current = true;
        lastTranslatedTextRef.current = normText;
        lastWordCountRef.current = wordCount;
        return;
      }

      setIsTranslating(true);
      setEngineStatus('translating');

      const keys = getTranslationApiKeys();

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

      try {
        const rawSegments = splitLongForTranslation(sourceForTranslate, { maxWords: 40 });
        const labeled = assignSegmentIds(rawSegments);
        const activeKeys = [];
        const segmentSources = [];
        let lastMeta = emptyMeta;
        let anyOk = false;
        let anyFailed = false;

        for (const { segmentId, text: segText } of labeled) {
          if (signal.aborted) break;

          const sourceHash = hashTranslationSource(segText);
          const requestId = buildSegmentRequestId({
            captionId: capId,
            segmentId,
            sourceHash,
            targetLang: tLang,
          });
          activeKeys.push(requestId);
          segmentSources.push({ key: requestId, sourceText: segText });

          const res = await fetchChunk(segText);
          lastMeta = {
            engineId: res.engineId,
            quality: res.quality,
            failures: res.failures || [],
            tried: res.tried || [],
          };

          const prev = translationsMapRef.current[requestId] || null;
          const { state: nextMap, entry } = applyTranslationResult(translationsMapRef.current, {
            captionId: capId,
            segmentId,
            sourceText: segText,
            sourceHash,
            targetLang: tLang,
            previousEntry: prev,
            engineResult: {
              text: res.text || '',
              engineId: res.engineId,
              quality: res.quality || (res.text ? 'ok' : 'failed'),
              requestId,
            },
          });
          translationsMapRef.current = nextMap;
          persistIfSealed(entry);
          if (entry.status === 'ok' || entry.status === 'weak') anyOk = true;
          if (entry.status === 'failed' || entry.passthrough || entry.warning) anyFailed = true;
        }

        if (signal.aborted) return;

        // Never silent blank: compose joins segment texts / source passthrough.
        const composed = composeCaptionTranslation(
          translationsMapRef.current,
          activeKeys,
          segmentSources,
        );
        setTranslationMeta({
          ...lastMeta,
          quality: anyOk && !anyFailed ? lastMeta.quality : anyOk ? 'weak' : 'failed',
        });

        if (!langPairRef.current) langPairRef.current = langPair;
        setTranslation(composed || sourceForTranslate);
        hasGoodTranslationRef.current = anyOk || Boolean(composed);
        lastTranslatedTextRef.current = normText;
        lastWordCountRef.current = wordCount;

        if (
          shouldPrefetch &&
          typeof prefetchTTS === 'function' &&
          composed &&
          anyOk &&
          !isTranslationPassthrough(sourceForTranslate, composed, sLang, tLang)
        ) {
          const url = await prefetchTTS(composed, tLang);
          setAudioUrl(url);
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
  }, [
    text,
    lang,
    shouldPrefetch,
    prefetchTTS,
    currentLangPair,
    mood,
    forceTranslateKey,
    isFinal,
    languagePair,
    mockTranslation,
    userTranslationOverride,
    correctionsRev,
    captionId,
    targetLang,
    persistIfSealed,
  ]);

  return {
    translation,
    audioUrl,
    isTranslating,
    engineStatus,
    translationMeta,
    targetLang: (langPairRef.current || currentLangPair).split('-')[1],
  };
};
