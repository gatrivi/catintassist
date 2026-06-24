/**
 * Caption engine — finals vs live draft, stable Deepgram IDs. v4.72.0
 */
import {
  applyTranscriptFormatting,
  splitLongTextAtCommas,
  peelCompleteSentences,
} from "./transcriptFormat";
import {
  hallucinationGuard,
  removeOverlapPreservingDigitSequences,
} from "./sensitiveDataProtector";
import {
  laneSideForLang,
  langForLaneSide,
} from "./languageConfig";

export const INTERIM_THROTTLE_MS = 150;
export const CAPTION_ROW_LIMIT = 150;

const sealText = (raw, lang) => applyTranscriptFormatting(raw.trim(), lang);

/** Stable row id: dg channel + utterance start + final/interim. */
export const buildStableCaptionId = (channelKey, startTime, isFinal) =>
  `dg-${channelKey || "unk"}-${startTime ?? 0}-${isFinal ? "f" : "i"}`;

export const createCaptionEngineState = () => ({ finals: [], liveDraft: null });

export const mergeCaptionsForUi = (state) => {
  const { finals, liveDraft } = state || createCaptionEngineState();
  const merged = liveDraft ? [...finals, liveDraft] : [...finals];
  return merged.slice(-CAPTION_ROW_LIMIT);
};

export const splitCaptionRows = (rows) => {
  if (!rows?.length) return createCaptionEngineState();
  const last = rows[rows.length - 1];
  if (last?.isFinal === false) {
    return { finals: rows.slice(0, -1), liveDraft: last };
  }
  return { finals: rows, liveDraft: null };
};

export const initEngineFromPersisted = (captions) => splitCaptionRows(captions || []);

const buildSealedBubble = (
  sentence,
  template,
  bubbleIdCounterRef,
  turnWordCount,
  pair,
  channelKey,
  startTime,
  sealIndex,
) => {
  const lang = template.lang || pair.left;
  const text = sealText(sentence, lang);
  const side = laneSideForLang(lang, pair);
  const id =
    sealIndex === 0 && template.id
      ? template.id
      : `${buildStableCaptionId(channelKey, startTime, true)}-s${sealIndex}-${++bubbleIdCounterRef.current}`;
  return {
    ...template,
    id,
    text,
    turnId: template.turnId,
    turnWordCount,
    enFinalized: side === "en" ? text : "",
    esFinalized: side === "es" ? text : "",
    enInterim: "",
    esInterim: "",
    enFull: side === "en" ? text : template.enFull,
    esFull: side === "es" ? text : template.esFull,
    isFinal: true,
  };
};

const peelCommaChunks = (
  text,
  template,
  bubbleIdCounterRef,
  turnWordsBase,
  pair,
  channelKey,
  startTime,
) => {
  const chunks = splitLongTextAtCommas(text, 40);
  if (!chunks.length) return { sealed: [], remainder: text };

  let acc = turnWordsBase;
  const sealed = chunks.map((chunk, idx) => {
    const w = chunk.trim().split(/\s+/).filter(Boolean).length;
    acc += w;
    return buildSealedBubble(
      chunk,
      template,
      bubbleIdCounterRef,
      acc,
      pair,
      channelKey,
      startTime,
      idx + 1,
    );
  });
  return { sealed, remainder: "" };
};

/**
 * Deepgram transcript event → caption row array (finals + optional live draft).
 * Preserves existing caption object fields and sealing behavior.
 */
export const reduceTranscriptEvent = (prev, event, ctx) => {
  const {
    transcript,
    isFinal,
    speechFinal,
    confidence,
    laneSide,
    channelKey,
    startTime,
    now,
    isSilentBreak,
    protectionsOn,
    langMode,
    pair,
  } = event;
  const { turnWordsBaseRef, currentTurnIdRef, bubbleIdCounterRef, lastBubbleStartedRef } = ctx;

  const shouldFinalize = isFinal || speechFinal;

  let last = prev[prev.length - 1];
  const isNewTurn = isSilentBreak || !last;

  if (isNewTurn) {
    const lastStarted = lastBubbleStartedRef?.current || 0;
    if (!(now - lastStarted < 400 && !isSilentBreak)) {
      if (lastBubbleStartedRef) lastBubbleStartedRef.current = now;
      if (isSilentBreak || !last) {
        turnWordsBaseRef.current = 0;
        currentTurnIdRef.current = `turn-${now}`;
      } else if (!currentTurnIdRef.current) {
        currentTurnIdRef.current = last.turnId || `turn-${now}`;
      }

      last = {
        id: buildStableCaptionId(channelKey, startTime, false),
        enFinalized: "",
        enInterim: "",
        esFinalized: "",
        esInterim: "",
        turnId: currentTurnIdRef.current,
        turnWordCount: turnWordsBaseRef.current,
        isSplit: !isSilentBreak,
        tailPreviewText: null,
        isFinal: false,
      };
      prev = [...prev, last];
    }
  }

  const current = { ...last };
  const historyText = prev
    .slice(-4, -1)
    .map((c) => c.text || "")
    .join(" ");
  const currentFinalized =
    (laneSide === "en" ? current.enFinalized : current.esFinalized) || "";
  const baseContext = (historyText + " " + currentFinalized).trim();

  const cleaned = removeOverlapPreservingDigitSequences(baseContext, transcript);
  if (!cleaned.trim() && !shouldFinalize) return prev;

  if (shouldFinalize) {
    const merged = (
      (laneSide === "en" ? current.enFinalized : current.esFinalized) +
      " " +
      cleaned
    ).trim();
    const finalized = protectionsOn ? hallucinationGuard(merged) : merged;
    if (laneSide === "en") {
      current.enFinalized = finalized;
      current.enInterim = "";
    } else {
      current.esFinalized = finalized;
      current.esInterim = "";
    }
  } else if (laneSide === "en") {
    current.enInterim = cleaned;
  } else {
    current.esInterim = cleaned;
  }

  const enFull = (current.enFinalized + " " + current.enInterim).trim();
  const esFull = (current.esFinalized + " " + current.esInterim).trim();
  const leftW = enFull.split(/\s+/).filter(Boolean).length;
  const rightW = esFull.split(/\s+/).filter(Boolean).length;

  let winnerLang = langForLaneSide("en", pair);
  if (rightW >= leftW + 2) winnerLang = langForLaneSide("es", pair);
  else if (leftW >= rightW + 2) winnerLang = langForLaneSide("en", pair);
  else {
    winnerLang =
      confidence > 0.8 && rightW > 0
        ? langForLaneSide("es", pair)
        : langForLaneSide("en", pair);
  }

  if (langMode === "left") winnerLang = pair.left;
  else if (langMode === "right") winnerLang = pair.right;

  const winSide = laneSideForLang(winnerLang, pair);
  current.lang = winnerLang;
  current.text = winSide === "en" ? enFull : esFull;
  current.enFull = enFull;
  current.esFull = esFull;
  current.isFinal = shouldFinalize;
  if (!shouldFinalize) {
    current.tailPreviewText = null;
  }
  const currentWords = current.text.split(/\s+/).filter(Boolean).length;
  current.turnId = current.turnId || currentTurnIdRef.current || `turn-${now}`;
  current.turnWordCount = turnWordsBaseRef.current + currentWords;

  let newArr = [...prev];
  newArr[newArr.length - 1] = current;

  if (shouldFinalize && current.text?.trim()) {
    const originalLastId = last?.id;
    const { sentences, remainder: sentRemainder } = peelCompleteSentences(current.text);
    let sealedAll = [];
    let tailText = sentRemainder;

    if (sentences.length > 0) {
      let acc = turnWordsBaseRef.current;
      sealedAll = sentences.map((sent, idx) => {
        const w = sent.trim().split(/\s+/).filter(Boolean).length;
        acc += w;
        return buildSealedBubble(
          sent,
          current,
          bubbleIdCounterRef,
          acc,
          pair,
          channelKey,
          startTime,
          idx,
        );
      });
      turnWordsBaseRef.current = acc;
    }

    if (tailText?.trim()) {
      const { sealed: commaSealed, remainder: commaRemainder } = peelCommaChunks(
        tailText,
        current,
        bubbleIdCounterRef,
        turnWordsBaseRef.current,
        pair,
        channelKey,
        startTime,
      );
      if (commaSealed.length) {
        sealedAll = [...sealedAll, ...commaSealed];
        turnWordsBaseRef.current = commaSealed[commaSealed.length - 1].turnWordCount;
        tailText = commaRemainder;
      }
    }

    if (!sentences.length && !sealedAll.length && current.text?.trim()) {
      const { sealed: commaOnly, remainder: commaRemainder } = peelCommaChunks(
        current.text,
        current,
        bubbleIdCounterRef,
        turnWordsBaseRef.current,
        pair,
        channelKey,
        startTime,
      );
      if (commaOnly.length) {
        sealedAll = commaOnly;
        turnWordsBaseRef.current = commaOnly[commaOnly.length - 1].turnWordCount;
        tailText = commaRemainder;
      }
    }

    if (sealedAll.length > 0) {
      const hasTail = Boolean(tailText?.trim());
      if (hasTail && sealedAll[0]?.id === originalLastId) {
        sealedAll[0] = {
          ...sealedAll[0],
          id: `${buildStableCaptionId(channelKey, startTime, true)}-s0-${++bubbleIdCounterRef.current}`,
        };
      } else if (sealedAll[0] && originalLastId && !hasTail) {
        sealedAll[0] = { ...sealedAll[0], id: originalLastId };
      }
      newArr = [...prev.slice(0, -1), ...sealedAll];
      if (hasTail) {
        const winLang = current.lang || pair.left;
        const tailSide = laneSideForLang(winLang, pair);
        const formatted = sealText(tailText, winLang);
        newArr.push({
          ...current,
          id: originalLastId,
          turnId: current.turnId,
          turnWordCount: turnWordsBaseRef.current,
          text: formatted,
          tailPreviewText: tailText.trim(),
          enFinalized: tailSide === "en" ? formatted : "",
          esFinalized: tailSide === "es" ? formatted : "",
          enInterim: tailSide === "en" ? current.enInterim : "",
          esInterim: tailSide === "es" ? current.esInterim : "",
          enFull:
            tailSide === "en"
              ? `${formatted} ${current.enInterim || ""}`.trim()
              : current.enFull,
          esFull:
            tailSide === "es"
              ? `${formatted} ${current.esInterim || ""}`.trim()
              : current.esFull,
          isFinal: false,
        });
      }
    }
  }

  return newArr.slice(-CAPTION_ROW_LIMIT);
};

/** Whether UI should flush immediately (final) vs throttle (interim only). */
export const shouldFlushImmediately = (isFinal, speechFinal) =>
  Boolean(isFinal || speechFinal);
