import { useState, useRef, useEffect, useCallback } from 'react';
import {
  isTranslationPassthrough,
  isShortIdentityTranslation,
  splitLongForTranslation,
  isIncrementalTranscriptGrowth,
  isSentenceComplete,
} from '../utils/translationQuality';
import {
  applySttCorrections,
  findGlossaryTranslation,
  applyGlossaryPhrases,
  CORRECTIONS_CHANGED_EVENT,
} from '../utils/transcriptCorrections';
// v4.161.0 — off / exact / phrase, the operator's call, read per request
import { loadGlossaryMode } from '../utils/glossaryMode';
// v4.167.0 — FAST by default: the operator picks the translation latency ladder
import { loadTranslationLatencyLadder } from '../utils/translationLatencyMode';
import { catLog } from '../utils/catLog';
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
import { correctSourceLang } from '../utils/textLanguage';
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

let TRANS_DEAD = {};

// A segment that keeps failing is re-requested on every occurrence, so a
// broken phrase (long echo, both engines down) loops all session. Mark it
// proven-bad after a few failures; any success clears the mark. Session-only:
// a reload re-tries everything on purpose.
const DEAD_AFTER_FAILURES = 3;

const noteChunkOutcome = (key, ok) => {
  if (ok) {
    delete TRANS_DEAD[key];
    return;
  }
  if (Object.keys(TRANS_DEAD).length > MAX_MEM_CACHE) TRANS_DEAD = {};
  TRANS_DEAD[key] = (TRANS_DEAD[key] || 0) + 1;
};

const DEAD_CHUNK = { text: '', engineId: 'dead', quality: 'failed', failures: [], tried: [] };

const acceptTranslation = (source, result, sLang, tLang) => {
  const clean = (result || '').trim();
  if (!clean) return '';
  // "Okay." -> "Okay." is the right answer, not an engine echo. Rejecting it
  // meant the same phrase was refetched on every later occurrence.
  if (isShortIdentityTranslation(source, clean)) return clean;
  if (isTranslationPassthrough(source, clean, sLang, tLang)) return '';
  return clean;
};

/** Echo guard for a settled result: identity stock phrases are legitimate. */
const isSourceEcho = (source, out, sLang, tLang) =>
  Boolean(out)
  && !isShortIdentityTranslation(source, out)
  && isTranslationPassthrough(source, out, sLang, tLang);

const emptyMeta = {
  engineId: null,
  quality: 'idle',
  failures: [],
  tried: [],
};

/** Old cached rows can predate the echo guard. Never rehydrate them as translations. */
export const discardPersistedPassthroughEntries = (entries = {}, sourceLang, targetLang) =>
  Object.fromEntries(
    Object.entries(entries).filter(([, entry]) => {
      const source = String(entry?.sourceText || '').trim();
      const translated = String(entry?.text || '').trim();
      return !source || !translated || !isSourceEcho(source, translated, sourceLang, targetLang);
    }),
  );

/** Debounce ms for translation — 0 on bubble split so first chunk re-translates immediately.
 * v4.178.0: 0 for sealed text too (STT final or a finished sentence). Waiting
 * 800 ms on words that will not change only delays them. Interim keeps the wait. */
export function resolveTranslateDebounceMs({ isSplitRewrite, forceTrigger, mood = 'auto', isSealed = false }) {
  if (isSplitRewrite || isSealed) return 0;
  const debounceTimes = { auto: 800, fast: 300, default: 600, chill: 1000 };
  return forceTrigger ? (mood === 'auto' ? 800 : 200) : debounceTimes[mood] || 600;
}

/** Auto mode: wait for a small mouthful, then translate only meaningful updates. */
export const shouldRunAutoTranslation = ({
  isFinal,
  isComplete,
  isSplitRewrite,
  wordCount,
  lastWordCount,
}) => {
  // Do not spend a request on a single STT word ("um", "yes", a partial name).
  if (wordCount < 2) return false;
  if (isFinal || isComplete || isSplitRewrite) return true;
  return wordCount >= 10 && wordCount - lastWordCount >= 10;
};

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
  // v4.86.1 freeze: keep readable translation on STT edits; badge via isStale.
  const [isStale, setIsStale] = useState(false);
  const prevSegmentsRef = useRef([]);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const turnSeqRef = useRef(0);
  const hasGoodTranslationRef = useRef(false);
  const translationRef = useRef('');
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
    const persistedSourceLang = normalizeLang(correctSourceLang(text, lang, languagePair));
    const persistedTargetLang = getOppositeLang(persistedSourceLang, languagePair);
    translationsMapRef.current = discardPersistedPassthroughEntries(
      persistedTranslations,
      persistedSourceLang,
      persistedTargetLang,
    );
    const composed = composeCaptionTranslation(translationsMapRef.current);
    if (composed) {
      const hasPassthrough = Object.values(translationsMapRef.current)
        .some((entry) => entry?.passthrough);
      setTranslation(composed);
      setEngineStatus('ready');
      setTranslationMeta({
        engineId: 'idb',
        quality: hasPassthrough ? 'failed' : 'ok',
        failures: [],
        tried: ['idb'],
        passthrough: hasPassthrough,
      });
      hasGoodTranslationRef.current = !hasPassthrough;
      if (text) {
        const norm = text.trim().replace(/\s+/g, ' ');
        lastTranslatedTextRef.current = norm;
        prevTextRef.current = norm;
      }
    }
  }, [lang, languagePair, persistedTranslations, text]);

  // v4.175.0: translate FROM the language the words are really in. A bubble
  // opened by the ES socket can hold English; trusting its label asked es→en,
  // got the same text back, and the bubble showed no translation at all.
  const sourceLang = normalizeLang(correctSourceLang(text, lang, languagePair));
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
      setIsStale(false);
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
      // v4.86.1 freeze: never blank readable text. Keep display + map (tail
      // bubble reuses same captionId so prefix carries over); mark stale.
      // Only reset word gate so the new tail re-triggers promptly.
      lastWordCountRef.current = 0;
      if (translationRef.current) setIsStale(true);
      setEngineStatus('translating');
    } else if (normText !== lastTranslatedTextRef.current && translationRef.current) {
      // Incremental growth with a readable translation on screen: freeze
      // display until the tail fetch resolves (badge via isStale).
      setIsStale(true);
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
      if (!shouldRunAutoTranslation({
        isFinal: sealed,
        isComplete: complete,
        isSplitRewrite,
        wordCount,
        lastWordCount: lastWordCountRef.current,
      })) return;
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
        ? shouldRunAutoTranslation({
          isFinal: isFinal !== false,
          isComplete: isSentenceComplete(normText),
          isSplitRewrite,
          wordCount,
          lastWordCount: lastWordCountRef.current,
        })
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

    const isSealed = isFinal !== false || isSentenceComplete(normText);
    const waitTime = resolveTranslateDebounceMs({ isSplitRewrite, forceTrigger, mood, isSealed });
    // v4.178.0 latency probe: "STT final" -> "translation on screen".
    // Read it with __CAT_DUMP('[trans] latency').
    const turnStartedAt = Date.now();
    turnSeqRef.current += 1;
    const turnSeq = turnSeqRef.current;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      const langPair = langPairRef.current || currentLangPair;
      const [sLang, tLang] = langPair.split('-');
      const capId = captionId || `anon-${hashTranslationSource(normText)}`;

      // `let`, not `const`: the glossary 'phrase' branch below rewrites this when a
      // pinned term is hit. As a `const` that assignment THREW, killing the whole turn.
      let sourceForTranslate = applySttCorrections(normText, sLang);

      // v4.161.0 — the glossary mode is the operator's call, read per request so a
      // change in Settings applies to the next line without a reload.
      const glossaryMode = loadGlossaryMode();

      if (glossaryMode === 'phrase') {
        // Pinned TERMS first: they change the wording the engine receives, so the
        // engine does the rest. Never returns a full sentence the operator did
        // not write — only the pinned fragments inside this one.
        const { text: withPhrases, applied } = applyGlossaryPhrases(
          sourceForTranslate,
          sLang,
          tLang,
        );
        if (applied.length) {
          catLog('[glossary] phrase', { capId, applied });
          sourceForTranslate = withPhrases;
        }
      } else if (glossaryMode === 'exact') {
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
      }

      setIsTranslating(true);
      setEngineStatus('translating');

      const keys = getTranslationApiKeys();

      // v4.178.0: only the GROWING TAIL is abortable. A finished segment keeps
      // running when newer STT text arrives: the server would decode it anyway,
      // so the result lands in cache / dedupeInFlight and the next turn reuses it
      // instead of queueing a second copy behind the wasted one.
      const fetchChunk = async (chunk, { abortable = true } = {}) => {
        const norm = chunk.trim().replace(/\s+/g, ' ');
        const cacheKey = `${langPair}:${norm}`;
        const reqSignal = abortable ? signal : undefined;
        // An abortable tail never joins (or lends) a shared promise: an older
        // turn's abort must not kill this turn's request.
        const flightKey = abortable ? `${cacheKey}#turn${turnSeq}` : cacheKey;

        if ((TRANS_DEAD[cacheKey] || 0) >= DEAD_AFTER_FAILURES) return DEAD_CHUNK;

        const cached = getCached(norm, langPair);
        if (cached) {
          const accepted = acceptTranslation(norm, cached, sLang, tLang);
          if (accepted) {
            return { text: accepted, engineId: 'cache', quality: 'ok', failures: [], tried: ['cache'] };
          }
        }

        return dedupeInFlight(flightKey, () =>
          withTranslationSlot(async () => {
            const res = await translateWithFallback({
              text: norm,
              sLang,
              tLang,
              keys,
              signal: reqSignal,
              acceptFn: acceptTranslation,
              // v4.167.0: the operator's latency ladder, read per request so the
              // setting applies to the next line with no reload.
              ladder: loadTranslationLatencyLadder(),
            });
            if (res.text) setCached(norm, langPair, res.text);
            // An abort means a newer turn replaced this one, not a bad phrase.
            if (!reqSignal?.aborted) noteChunkOutcome(cacheKey, Boolean(res.text));
            return res;
          }, { signal: reqSignal, lane: langPair }),
        );
      };

      try {
        // v4.94.0: tiny chunks only — one sentence or one comma-clause per
        // request. Long chunks stalled the local model for minutes.
        const rawSegments = splitLongForTranslation(sourceForTranslate);
        const labeled = assignSegmentIds(rawSegments);
        const activeKeys = [];
        const segmentSources = [];
        let lastMeta = emptyMeta;
        let anyOk = false;
        let anyFailed = false;
        let anyPassthrough = false;

        // v4.86.1 tail-only: reuse good translations for unchanged prefix
        // segments so small STT edits don't refetch (or destroy) them.
        const prevBySource = new Map();
        Object.values(translationsMapRef.current || {}).forEach((e) => {
          const src = String(e?.sourceText || '').trim().replace(/\s+/g, ' ');
          if (src && e?.text && (e.status === 'ok' || e.status === 'weak')) {
            if (!prevBySource.has(src)) prevBySource.set(src, e);
          }
        });

        // v4.178.0 progressive display: paint each segment as soon as it lands
        // so the operator reads sentence 1 while sentence 2 is translated.
        // Never shrinks a longer readable translation (no vanishing text).
        let shownFirstAt = 0;
        const paintSoFar = () => {
          if (signal.aborted) return;
          const partial = composeCaptionTranslation(
            translationsMapRef.current,
            activeKeys,
            segmentSources,
          );
          if (!partial) return;
          const onScreen = translationRef.current || '';
          if (hasGoodTranslationRef.current && partial.length < onScreen.length) return;
          setTranslation(partial);
          translationRef.current = partial;
          hasGoodTranslationRef.current = true;
          if (!shownFirstAt) shownFirstAt = Date.now();
        };

        for (let segIndex = 0; segIndex < labeled.length; segIndex += 1) {
          const { segmentId, text: segText } = labeled[segIndex];
          if (signal.aborted) break;
          const isTail = segIndex === labeled.length - 1;
          // Punctuated interim text can still be revised by STT, so only a FINAL tail is done.
          const segmentDone = !isTail || isFinal !== false;

          const sourceHash = hashTranslationSource(segText);
          const requestId = buildSegmentRequestId({
            captionId: capId,
            segmentId,
            sourceHash,
            targetLang: tLang,
          });
          activeKeys.push(requestId);
          segmentSources.push({ key: requestId, sourceText: segText });

          // Exact-text prefix hit: carry over, no network, no display churn.
          const carried = prevBySource.get(segText);
          if (carried && carried.targetLang === tLang) {
            const { state: nextMap, entry } = applyTranslationResult(translationsMapRef.current, {
              captionId: capId,
              segmentId,
              sourceText: segText,
              sourceHash,
              targetLang: tLang,
              engineResult: {
                text: carried.text,
                engineId: carried.engineId,
                quality: carried.quality || carried.status || 'ok',
                requestId,
              },
            });
            translationsMapRef.current = nextMap;
            persistIfSealed(entry);
            lastMeta = {
              engineId: entry.engineId,
              quality: entry.quality,
              failures: [],
              tried: ['carry-prefix'],
            };
            if (entry.status === 'ok' || entry.status === 'weak') anyOk = true;
            continue;
          }

          const res = await fetchChunk(segText, { abortable: !segmentDone });
          // The generic engine keeps legitimate weak short answers. At this
          // EN/ES boundary, however, an echoed source is never a translation —
          // unless it is a short stock phrase that really is its own translation.
          const usableRes = isSourceEcho(segText, res.text, sLang, tLang)
            ? { ...res, text: '', quality: 'failed' }
            : res;
          lastMeta = {
            engineId: usableRes.engineId,
            quality: usableRes.quality,
            failures: usableRes.failures || [],
            tried: usableRes.tried || [],
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
              text: usableRes.text || '',
              engineId: usableRes.engineId,
              quality: usableRes.quality || (usableRes.text ? 'ok' : 'failed'),
              requestId,
            },
          });
          translationsMapRef.current = nextMap;
          persistIfSealed(entry);
          if (entry.status === 'ok' || entry.status === 'weak') anyOk = true;
          if (entry.status === 'failed' || entry.passthrough || entry.warning) anyFailed = true;
          if (entry.passthrough) anyPassthrough = true;
          // More segments still to fetch: show what we have now.
          if (!isTail && (entry.status === 'ok' || entry.status === 'weak')) paintSoFar();
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
          passthrough: anyPassthrough,
        });

        // v4.175.0: only a SUCCESSFUL round locks the direction. A failed round
        // (wrong-language passthrough) used to lock it, so the bubble stayed blank.
        if (anyOk && !langPairRef.current) langPairRef.current = langPair;
        // v4.86.1 freeze: a failed/empty round must never overwrite readable text.
        if (anyOk || !hasGoodTranslationRef.current) {
          setTranslation(composed || sourceForTranslate);
          hasGoodTranslationRef.current = anyOk || Boolean(composed);
        }
        if (isFinal !== false) {
          const now = Date.now();
          catLog('[trans] latency', {
            capId,
            segments: labeled.length,
            firstMs: (shownFirstAt || now) - turnStartedAt,
            fullMs: now - turnStartedAt,
          });
        }
        prevSegmentsRef.current = labeled.map((s) => s.text);
        lastTranslatedTextRef.current = normText;
        lastWordCountRef.current = wordCount;
        setIsStale(false);

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
        if (e.name !== 'AbortError') {
          console.error('[Trans] Catch:', e);
          // Failed round: keep frozen display, drop the badge.
          setIsStale(false);
        }
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

  // Mirror for the freeze check above (ref avoids an effect dep loop).
  useEffect(() => {
    translationRef.current = translation;
  }, [translation]);

  return {
    translation,
    audioUrl,
    isTranslating,
    isStale,
    engineStatus,
    translationMeta,
    targetLang: (langPairRef.current || currentLangPair).split('-')[1],
  };
};
