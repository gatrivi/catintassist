/**
 * Stateful-pure Deepgram Results → caption engine.
 * Live WS and fixture replay both use this — no React setters.
 */
import {
  mergeCaptionsForUi,
  reduceTranscriptEvent,
  splitCaptionRows,
} from "./captionEngine";
import { laneSideForLang } from "./languageConfig";

/**
 * @param {object} args
 * @param {{ finals: any[], liveDraft: any }} args.engineState
 * @param {any[]} [args.rows] - optional UI rows; defaults to mergeCaptionsForUi(engineState)
 * @param {object} args.payload - Deepgram Results-like JSON
 * @param {string} args.lane - channel key (e.g. "en" | "es" | "multi")
 * @param {object} args.ctxMeta
 * @returns {{ nextEngineState, nextRows, debug } | null} null if empty / skip
 */
export function applyDeepgramTranscriptPayload({
  engineState,
  rows,
  payload,
  lane,
  ctxMeta,
}) {
  const {
    pair = { left: "en", right: "es" },
    langMode = "auto",
    protectionsOn = false,
    now = Date.now(),
    isSilentBreak = false,
    laneSide: laneSideOverride,
    channelKey: channelKeyOverride,
    turnWordsBaseRef,
    currentTurnIdRef,
    bubbleIdCounterRef,
    lastBubbleStartedRef,
  } = ctxMeta || {};

  const alt = payload?.channel?.alternatives?.[0];
  const transcript = alt?.transcript;
  if (!transcript || !String(transcript).trim()) {
    return null;
  }

  const confidence = alt?.confidence || 0;
  const isFinal = !!payload?.is_final;
  const speechFinal = !!payload?.speech_final;
  const startTime = payload?.start ?? 0;
  const words = alt?.words || [];
  const wordConfidenceCount = words.filter((w) => Number.isFinite(w?.confidence)).length;

  const socketLaneLang =
    lane === "multi"
      ? payload?.channel?.detected_language ||
        alt?.languages?.[0] ||
        pair.left
      : lane;
  const resolvedLaneSide =
    laneSideOverride || laneSideForLang(socketLaneLang, pair);

  const prevRows = Array.isArray(rows)
    ? rows
    : mergeCaptionsForUi(engineState || { finals: [], liveDraft: null });

  const nextRows = reduceTranscriptEvent(
    prevRows,
    {
      transcript,
      words,
      isFinal,
      speechFinal,
      confidence,
      laneSide: resolvedLaneSide,
      channelKey: channelKeyOverride ?? lane,
      startTime,
      now,
      isSilentBreak,
      protectionsOn,
      langMode,
      pair,
    },
    {
      turnWordsBaseRef,
      currentTurnIdRef,
      bubbleIdCounterRef,
      lastBubbleStartedRef,
    },
  );

  const nextEngineState = splitCaptionRows(nextRows);
  const lastRow = nextRows[nextRows.length - 1] || null;

  return {
    nextEngineState,
    nextRows,
    debug: {
      transcript: String(transcript).slice(0, 160),
      isFinal,
      speechFinal,
      confidence,
      lane,
      laneSide: resolvedLaneSide,
      startTime,
      wordConfidenceCount,
      rowCount: nextRows.length,
      lastRowId: lastRow?.id || null,
      lastRowFinal: !!lastRow?.isFinal,
    },
  };
}
