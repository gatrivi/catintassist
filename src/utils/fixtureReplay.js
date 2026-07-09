/**
 * Replay Deepgram-shaped fixture events through applyDeepgramTranscriptPayload.
 * Sync for Jest; timed for Test Harness UI.
 */
import {
  createCaptionEngineState,
  mergeCaptionsForUi,
} from "./captionEngine";
import { applyDeepgramTranscriptPayload } from "./applyDeepgramTranscriptPayload";

const makeRef = (initial) => ({ current: initial });

/** Mutable refs matching live useDeepgram caption-engine context. */
export function createReplayCtxRefs() {
  return {
    turnWordsBaseRef: makeRef(0),
    currentTurnIdRef: makeRef(null),
    bubbleIdCounterRef: makeRef(0),
    lastBubbleStartedRef: makeRef(0),
  };
}

/**
 * Sync replay of fixture.events through the live caption pipeline.
 * @param {object} fixture
 * @param {object} [opts]
 * @returns {{ engineState, rows, steps, debugLog }}
 */
export function replayFixtureEvents(fixture, opts = {}) {
  const meta = { ...(fixture?.meta || {}), ...(opts.meta || {}) };
  const pair = meta.pair || { left: "en", right: "es" };
  const protectionsOn = meta.protectionsOn !== false;
  const langMode = meta.langMode || "auto";
  const baseNow = opts.baseNow ?? 1_700_000_000_000;
  const silentBreakGapMs = meta.silentBreakGapMs ?? 2500;

  const refs = opts.refs || createReplayCtxRefs();
  let engineState = opts.engineState || createCaptionEngineState();
  let rows = opts.rows || mergeCaptionsForUi(engineState);
  let lastEventAt = null;
  const steps = [];
  const debugLog = [];

  const events = Array.isArray(fixture?.events) ? fixture.events : [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const atMs = Number.isFinite(ev.atMs) ? ev.atMs : i * 100;
    const now = baseNow + atMs;
    const isSilentBreak =
      ev.isSilentBreak === true ||
      (lastEventAt != null && now - lastEventAt > silentBreakGapMs) ||
      (meta.forceSilentBreakOnFirst === true && i === 0 && lastEventAt == null);

    // First event of a fresh replay is a new turn (empty engine).
    const silent =
      rows.length === 0
        ? true
        : isSilentBreak;

    const applied = applyDeepgramTranscriptPayload({
      engineState,
      rows,
      payload: ev.payload,
      lane: ev.lane || "en",
      ctxMeta: {
        pair,
        langMode,
        protectionsOn,
        now,
        isSilentBreak: silent,
        ...refs,
      },
    });

    lastEventAt = now;

    if (!applied) {
      steps.push({ index: i, atMs, skipped: true });
      continue;
    }

    engineState = applied.nextEngineState;
    rows = applied.nextRows;
    steps.push({
      index: i,
      atMs,
      skipped: false,
      debug: applied.debug,
      interim: !applied.debug.isFinal && !applied.debug.speechFinal,
      final: !!(applied.debug.isFinal || applied.debug.speechFinal),
    });
    debugLog.push(applied.debug);
    if (typeof opts.onStep === "function") {
      opts.onStep({ index: i, rows, engineState, debug: applied.debug });
    }
  }

  return { engineState, rows, steps, debugLog, refs };
}

/**
 * Timed UI replay — awaits delays between events (atMs).
 */
export async function replayFixtureEventsTimed(fixture, opts = {}) {
  const meta = { ...(fixture?.meta || {}), ...(opts.meta || {}) };
  const pair = meta.pair || { left: "en", right: "es" };
  const protectionsOn = meta.protectionsOn !== false;
  const langMode = meta.langMode || "auto";
  const baseNow = opts.baseNow ?? Date.now();
  const silentBreakGapMs = meta.silentBreakGapMs ?? 2500;
  const speed = opts.speed > 0 ? opts.speed : 1;

  const refs = opts.refs || createReplayCtxRefs();
  let engineState = opts.engineState || createCaptionEngineState();
  let rows = opts.rows || mergeCaptionsForUi(engineState);
  let lastEventAt = null;
  let lastAtMs = 0;
  const events = Array.isArray(fixture?.events) ? fixture.events : [];

  for (let i = 0; i < events.length; i++) {
    if (opts.signal?.aborted) break;
    const ev = events[i];
    const atMs = Number.isFinite(ev.atMs) ? ev.atMs : i * 100;
    const wait = Math.max(0, (atMs - lastAtMs) / speed);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastAtMs = atMs;
    const now = baseNow + atMs;
    const isSilentBreak =
      ev.isSilentBreak === true ||
      (lastEventAt != null && now - lastEventAt > silentBreakGapMs);
    const silent = rows.length === 0 ? true : isSilentBreak;

    const applied = applyDeepgramTranscriptPayload({
      engineState,
      rows,
      payload: ev.payload,
      lane: ev.lane || "en",
      ctxMeta: {
        pair,
        langMode,
        protectionsOn,
        now,
        isSilentBreak: silent,
        ...refs,
      },
    });
    lastEventAt = now;
    if (!applied) continue;
    engineState = applied.nextEngineState;
    rows = applied.nextRows;
    if (typeof opts.onStep === "function") {
      opts.onStep({ index: i, rows, engineState, debug: applied.debug });
    }
  }

  return { engineState, rows, refs };
}

/** Assert fixture.expect against final rows (Jest helper). */
export function assertFixtureExpect(rows, expectSpec = {}) {
  const finals = (rows || []).filter((r) => r.isFinal);
  const allText = (rows || []).map((r) => r.text || "").join(" ");
  const finalTexts = finals.map((r) => r.text || "");
  const langs = finals.map((r) => r.lang).filter(Boolean);

  const failures = [];

  if (Array.isArray(expectSpec.finalTexts)) {
    for (const needle of expectSpec.finalTexts) {
      const hit = finalTexts.some((t) => t.includes(needle));
      if (!hit) failures.push(`missing finalText: ${needle}`);
    }
  }

  if (Array.isArray(expectSpec.langs)) {
    for (const lang of expectSpec.langs) {
      if (!langs.includes(lang)) failures.push(`missing lang: ${lang}`);
    }
  }

  if (Array.isArray(expectSpec.preserveDigits)) {
    const digitsOnly = allText.replace(/\D/g, "");
    for (const d of expectSpec.preserveDigits) {
      const want = String(d).replace(/\D/g, "");
      if (!digitsOnly.includes(want)) {
        failures.push(`missing digits: ${want}`);
      }
    }
  }

  if (expectSpec.minFinals != null && finals.length < expectSpec.minFinals) {
    failures.push(`expected >= ${expectSpec.minFinals} finals, got ${finals.length}`);
  }

  if (expectSpec.hasInterimSteps === true) {
    // Caller should pass steps from replay; checked in tests separately.
  }

  return { ok: failures.length === 0, failures, finals, finalTexts, langs, allText };
}
