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
  isNumberLike,
} from "./sensitiveDataProtector";
import { armExpectedData } from "./expectedDataContext";
import {
  laneSideForLang,
  langForLaneSide,
} from "./languageConfig";
import { flagVanish } from "./vanishTrace";

export const INTERIM_THROTTLE_MS = 150;
export const CAPTION_ROW_LIMIT = 150;

const sealText = (raw, lang) => applyTranscriptFormatting(raw.trim(), lang);

/** Stable row id: dg channel + utterance start + final/interim. */
export const buildStableCaptionId = (channelKey, startTime, isFinal) =>
  `dg-${channelKey || "unk"}-${startTime ?? 0}-${isFinal ? "f" : "i"}`;

export const createCaptionEngineState = () => ({ finals: [], liveDraft: null });

// v4.136.0: digit runs ("93550", "93 550" ≡ "93550") — a lane flip may never
// drop one; the losing lane is sometimes the only one that heard the zip.
export const digitRunKeys = (text) =>
  (String(text || '').match(/\d[\d\s,.-]*\d|\d/g) || []).map((run) =>
    run.replace(/\D/g, ''),
  );
export const lostDigitRuns = (prevText, nextText) => {
  const nextKeys = new Set(digitRunKeys(nextText));
  return [...new Set(digitRunKeys(prevText))].filter((key) => !nextKeys.has(key));
};

const normalizeWord = (word) =>
  (word || "").toString().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * v4.141.0 — restarted-segment detection.
 *
 * Deepgram sometimes re-delivers a segment it has already finalized on the same
 * lane: an audio re-cut, a socket/reconnect replay, a re-segmentation. The
 * overlap guard (`removeOverlapPreservingDigitSequences`) only cleans a repeat
 * that starts at the base's TAIL — its comparison is "addition prefix ≡ base
 * suffix". So a restart that re-states a phrase from the HEAD or MIDDLE of the
 * base was appended verbatim as a second copy *inside one line*
 * (`laneFinalized + " " + cleaned`), then sealed, persisted and translated.
 *
 * This helper only LOOKS: it returns the length (in words) of the longest run of
 * LEADING words of `addition` that also occurs somewhere in `base` — 0 when the
 * leading words never repeat. Nothing is removed here; the caller routes such a
 * segment into its own bubble instead (see `reduceTranscriptEvent`).
 *
 * Words are compared case- and punctuation-insensitively, the same way the
 * overlap guard normalizes ("names," ≡ "names").
 */
export const RESTART_MIN_WORDS = 4;
/** A restart re-states a phrase; checking more than this only burns CPU. */
const RESTART_HEAD_MAX_WORDS = 24;

const captionWords = (text) =>
  (String(text || "").match(/\S+/g) || [])
    .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);

export const restatedHeadWindow = (base, addition) => {
  const b = captionWords(base);
  const a = captionWords(addition);
  if (b.length < RESTART_MIN_WORDS || a.length < RESTART_MIN_WORDS) return 0;
  const maxLen = Math.min(a.length, b.length, RESTART_HEAD_MAX_WORDS);
  for (let len = maxLen; len >= RESTART_MIN_WORDS; len -= 1) {
    const head = a.slice(0, len).join(" ");
    for (let start = 0; start + len <= b.length; start += 1) {
      if (b.slice(start, start + len).join(" ") === head) return len;
    }
  }
  return 0;
};

export const normalizeWordConfidence = (words = []) =>
  (Array.isArray(words) ? words : [])
    .map((w) => ({
      word: normalizeWord(w.word ?? w.punctuated_word ?? ""),
      confidence: Number.isFinite(w.confidence) ? w.confidence : null,
    }))
    .filter((w) => w.word);

const wordCount = (text) => (text || "").trim().split(/\s+/).filter(Boolean).length;

// v4.146.0 — digit veto for the restart split. Phone/ID dictation is
// constantly re-cut by Deepgram (a pause mid-number finalizes, then the next
// segment re-states the first digits). Splitting there scatters the run
// across bubbles, and the display stitch (per-bubble) can never group it into
// XXX-XXX-XXXX — the "phone number protector is not working" report. Mirrors
// the overlap guard's rule: digits (or a run of ≥2 number-words) at the
// boundary keep everything in ONE line; `collapseAdjacentDigitRepeats` +
// stitch heal the straddle dupe at display time. Nothing is deleted either
// way — this only decides routing.
const restartBoundaryHasNumbers = (base, addition) => {
  const window = `${(base || "").split(/\s+/).slice(-10).join(" ")} ${(addition || "")
    .split(/\s+/)
    .slice(0, 10)
    .join(" ")}`;
  // A digit RUN (>=2 digits, separators ok) — single ordinals like "1st" are
  // prose and must NOT veto the split (they ride along in normal restarts).
  if (/\d[\d\s.,/-]*\d/.test(window)) return true;
  let run = 0;
  for (const w of window.split(/\s+/).filter(Boolean)) {
    run = isNumberLike(w) ? run + 1 : 0;
    if (run >= 2) return true;
  }
  return false;
};

const sliceWordConfidenceForText = (wordConfidence, text, offset = 0) => {
  if (!wordConfidence?.length || !text?.trim()) return [];
  return wordConfidence.slice(offset, offset + wordCount(text));
};

const wordConfidenceKey = (words) =>
  words?.length ? words.map((w) => `${w.word}:${Math.round((w.confidence ?? -1) * 100)}`).join("|") : "";

const ensureUniqueCaptionIds = (rows) => {
  const seen = new Map();
  return (rows || []).map((row, idx) => {
    const base = row?.id || `caption-${idx}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    if (count === 0 && row?.id) return row;
    return { ...row, id: `${base}-dup${count}` };
  });
};

export const mergeCaptionsForUi = (state) => {
  const { finals, liveDraft } = state || createCaptionEngineState();
  // v4.93.2 CPU fix: never merge a blank live draft — a textless row can never
  // seal and spams ui_blank_caption_skipped on every board render.
  const merged = liveDraft?.text?.trim() ? [...finals, liveDraft] : [...finals];
  return ensureUniqueCaptionIds(merged.slice(-CAPTION_ROW_LIMIT));
};

/** Cheap equality — skip React flush when live row unchanged. */
export const captionsSnapshotEqual = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x?.id !== y?.id) return false;
    if (x?.text !== y?.text) return false;
    if (x?.isFinal !== y?.isFinal) return false;
    if (x?.tailPreviewText !== y?.tailPreviewText) return false;
    if (x?.sttEventId !== y?.sttEventId) return false;
    if (wordConfidenceKey(x?.wordConfidence) !== wordConfidenceKey(y?.wordConfidence)) return false;
  }
  return true;
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
  const wordConfidence = sliceWordConfidenceForText(
    template.wordConfidence,
    sentence,
    template.wordConfidenceOffset || 0,
  );
  const side = laneSideForLang(lang, pair);
  const id =
    sealIndex === 0 && template.id
      ? template.id
      : `${buildStableCaptionId(channelKey, startTime, true)}-s${sealIndex}-${++bubbleIdCounterRef.current}`;
  return {
    ...template,
    id,
    text,
    wordConfidence,
    wordConfidenceOffset: 0,
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
  let confidenceOffset = template.wordConfidenceOffset || 0;
  const sealed = chunks.map((chunk, idx) => {
    const w = wordCount(chunk);
    const chunkTemplate = { ...template, wordConfidenceOffset: confidenceOffset };
    acc += w;
    const sealedChunk = buildSealedBubble(
      chunk,
      chunkTemplate,
      bubbleIdCounterRef,
      acc,
      pair,
      channelKey,
      startTime,
      idx + 1,
    );
    confidenceOffset += w;
    return sealedChunk;
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
    words,
  } = event;
  const { turnWordsBaseRef, currentTurnIdRef, bubbleIdCounterRef, lastBubbleStartedRef } = ctx;

  const shouldFinalize = isFinal || speechFinal;
  const eventWordConfidence = normalizeWordConfidence(words);

  let last = prev[prev.length - 1];
  // v4.123.0: previous bubble already ended in sentence-final punctuation and a
  // new final arrived → start a fresh bubble. Prevents "wall of text" when a
  // speaker (nurse tirade) talks continuously without a silence break.
  // v4.141.0: only SEALED lane text may trigger this split. A live draft
  // (`isFinal === false`, still being rewritten) must not: the arriving final is
  // a rewrite of that same speech, so splitting there left the draft row
  // unsealed next to a sealed copy of itself — the same sentence twice.
  // Repro: interim "How are you feeling today?" + its final → 2 identical rows.
  const prevLaneFinal = last
    ? (laneSide === "en" ? last.enFinalized : last.esFinalized) ||
      (last.isFinal === false ? "" : last.text || "")
    : "";
  const startsAfterPeriod =
    shouldFinalize &&
    /[.!?…]["')\]]?\s*$/.test(prevLaneFinal.trim()) &&
    Boolean(transcript && String(transcript).trim());
  const isNewTurn = isSilentBreak || !last || startsAfterPeriod;

  if (isNewTurn) {
    const lastStarted = lastBubbleStartedRef?.current || 0;
    // Never skip the first bubble — empty prev left `last` undefined and broke STT.
    const debounceNewBubble =
      last && now - lastStarted < 400 && !isSilentBreak && !startsAfterPeriod;
    if (!debounceNewBubble) {
      if (lastBubbleStartedRef) lastBubbleStartedRef.current = now;
      if (isSilentBreak || !last) {
        turnWordsBaseRef.current = 0;
        currentTurnIdRef.current = `turn-${now}`;
      } else if (!currentTurnIdRef.current) {
        currentTurnIdRef.current = last.turnId || `turn-${now}`;
      }

      last = {
        id: buildStableCaptionId(channelKey, startTime, false),
        // v4.150.0: wall-clock ms this bubble started — powers the hover
        // timestamp (debug: correlate messages with __CAT_DUMP console logs).
        // Sealed copies inherit it via the template spread.
        createdAt: now,
        enFinalized: "",
        enInterim: "",
        esFinalized: "",
        esInterim: "",
        turnId: currentTurnIdRef.current,
        turnWordCount: turnWordsBaseRef.current,
        isSplit: !isSilentBreak,
        tailPreviewText: null,
        wordConfidence: [],
        wordConfidenceOffset: 0,
        isFinal: false,
      };
      prev = [...prev, last];
    }
  }

  if (!last && prev.length > 0) {
    last = prev[prev.length - 1];
  }
  if (!last) return prev;

  // The lane text this event would be APPENDED to (`merged = finalized + cleaned`
  // for finals, `enFull = finalized + interim` for drafts). Strictly the lane's
  // finalized text: an earlier interim is replaced, not appended, so it can never
  // duplicate itself and must never trigger a split.
  const laneFinalized = (laneSide === "en" ? last.enFinalized : last.esFinalized) || "";

  // After a sentence-boundary split the new bubble stands alone: its first
  // transcript often repeats words of the previous sentence ("the the…").
  // Skip overlap removal so nothing is eaten; the sealed previous bubble
  // already owns that text.
  const historyText = startsAfterPeriod
    ? ""
    : prev
        .slice(-4, -1)
        .map((c) => c.text || "")
        .join(" ");
  const baseContext = (historyText + " " + laneFinalized).trim();

  // One guard call per event. The split below only fires when this guard removed
  // NOTHING (`guardStripped === false`), and a brand-new bubble has no base text
  // to strip against anyway — so `cleaned` is valid in both branches.
  const cleaned = removeOverlapPreservingDigitSequences(baseContext, transcript);
  const guardStripped = wordCount(cleaned) < wordCount(transcript);

  // v4.141.0 — restarted segment: the incoming text re-states a phrase that is
  // already finalized on this lane, from its head or middle (not its tail, which
  // the guard above cleans on its own). Appending it would print those words
  // twice in ONE line and then seal/translate/persist that line. Nothing is
  // deleted here: the finalized row keeps every word, the restart gets its own
  // bubble below it (same primitive as the sentence-boundary split).
  const restatedWords =
    !startsAfterPeriod && !guardStripped && !restartBoundaryHasNumbers(laneFinalized, transcript)
      ? restatedHeadWindow(laneFinalized, transcript)
      : 0;
  if (restatedWords > 0) {
    const displaced = last;
    if (displaced?.isFinal === false) {
      if ((displaced.text || "").trim()) {
        // The row we leave behind can never grow again — freeze it as a sealed
        // row (translatable/editable/persistable like any other) and bank its
        // words into the turn counter so the turn badge stays monotonic.
        turnWordsBaseRef.current = (turnWordsBaseRef.current || 0) + wordCount(displaced.text);
        prev = [
          ...prev.slice(0, -1),
          { ...displaced, isFinal: true, tailPreviewText: null },
        ];
      } else {
        prev = prev.slice(0, -1); // blank draft row: nothing to keep
      }
    }
    if (lastBubbleStartedRef) lastBubbleStartedRef.current = now;
    last = {
      id: buildStableCaptionId(channelKey, startTime, false),
      // Same wall-clock stamp contract as the main turn template (v4.150.0).
      createdAt: now,
      enFinalized: "",
      enInterim: "",
      esFinalized: "",
      esInterim: "",
      turnId: displaced?.turnId || currentTurnIdRef.current || `turn-${now}`,
      turnWordCount: turnWordsBaseRef.current || 0,
      isSplit: true,
      tailPreviewText: null,
      wordConfidence: [],
      wordConfidenceOffset: 0,
      isFinal: false,
    };
    prev = [...prev, last];
    flagVanish('caption_restart_split', {
      id: last.id,
      turnId: last.turnId,
      before: `${laneFinalized} ${transcript}`.trim(),
      after: `${laneFinalized} || ${transcript}`,
      remount: true,
      force: true,
      stage: 'captionEngine.restartSplit',
      extra: { restatedWords, laneSide, startTime },
    });
  }

  const current = { ...last };
  if (!cleaned.trim() && !shouldFinalize) {
    flagVanish('overlap_empty_freeze', {
      id: current.id,
      turnId: current.turnId,
      before: current.text,
      after: current.text,
      stage: 'captionEngine.interim',
      force: true,
      extra: { note: 'cleaned empty — keep prev bubble', transcriptPreview: String(transcript).slice(0, 80) },
    });
    // v4.93.2: if the last row is the freshly appended blank draft (all lanes
    // empty), drop it instead of keeping a permanent blank row in state.
    const lanesEmpty =
      !current.text?.trim() &&
      !current.enFinalized?.trim() && !current.enInterim?.trim() &&
      !current.esFinalized?.trim() && !current.esInterim?.trim();
    if (lanesEmpty && prev.length && prev[prev.length - 1].id === current.id) {
      return prev.slice(0, -1);
    }
    return prev;
  }

  const textBeforeLane = current.text || '';

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
  // v4.136.0: a lane flip that would drop a digit run (zip/phone) keeps the
  // visible text — digits already shown must never vanish on a lane switch.
  const nextText = winSide === "en" ? enFull : esFull;
  const lostDigits = lostDigitRuns(textBeforeLane, nextText);
  if (lostDigits.length) {
    flagVanish('caption_lane_digit_guard', {
      id: current.id,
      turnId: current.turnId,
      before: textBeforeLane,
      after: nextText,
      stage: 'captionEngine.assignText',
      force: true,
      extra: { lostDigits, winnerLang },
    });
  } else {
    current.lang = winnerLang;
    current.text = nextText;
  }
  // v4.117.0: remember WHAT was just asked ("can I have your phone number?")
  // so digits arriving in later bubbles still format. Miss = keep prior arm.
  if (current.text?.trim()) {
    armExpectedData(current.text, { turnId: current.turnId });
  }
  if (current.text !== textBeforeLane && textBeforeLane) {
    const lost = textBeforeLane.split(/\s+/).filter(Boolean).length
      - (current.text || '').split(/\s+/).filter(Boolean).length;
    if (lost > 0 || (textBeforeLane.length > 8 && !(current.text || '').includes(textBeforeLane.slice(0, Math.min(12, textBeforeLane.length))))) {
      flagVanish('caption_lane_text_rewrite', {
        id: current.id,
        turnId: current.turnId,
        before: textBeforeLane,
        after: current.text,
        stage: 'captionEngine.assignText',
        extra: { winnerLang, shouldFinalize, enLen: enFull.length, esLen: esFull.length },
      });
    }
  }
  if (eventWordConfidence.length) {
    current.wordConfidence = eventWordConfidence;
  }
  current.wordConfidenceOffset = 0;
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
    const sourceWordBase = turnWordsBaseRef.current;

    if (sentences.length > 0) {
      let acc = turnWordsBaseRef.current;
      sealedAll = sentences.map((sent, idx) => {
        const w = wordCount(sent);
        const sentenceTemplate = { ...current, wordConfidenceOffset: acc - turnWordsBaseRef.current };
        acc += w;
        return buildSealedBubble(
          sent,
          sentenceTemplate,
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
        { ...current, wordConfidenceOffset: turnWordsBaseRef.current - sourceWordBase },
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
        { ...current, wordConfidenceOffset: 0 },
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
      flagVanish('caption_bubble_split', {
        id: originalLastId,
        turnId: current.turnId,
        before: current.text,
        after: sealedAll.map((s) => s.text).join(' || '),
        remount: true,
        force: true,
        stage: 'captionEngine.sealSplit',
        extra: {
          sealedCount: sealedAll.length,
          hasTail: Boolean(tailText?.trim()),
          sealedIds: sealedAll.map((s) => s.id),
        },
      });
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
        const tailWordConfidence = sliceWordConfidenceForText(
          current.wordConfidence,
          tailText,
          turnWordsBaseRef.current - sourceWordBase,
        );
        newArr.push({
          ...current,
          id: originalLastId,
          turnId: current.turnId,
          turnWordCount: turnWordsBaseRef.current,
          text: formatted,
          wordConfidence: tailWordConfidence,
          wordConfidenceOffset: 0,
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

  return ensureUniqueCaptionIds(newArr.slice(-CAPTION_ROW_LIMIT));
};

/** Whether UI should flush immediately (final) vs throttle (interim only). */
export const shouldFlushImmediately = (isFinal, speechFinal) =>
  Boolean(isFinal || speechFinal);
