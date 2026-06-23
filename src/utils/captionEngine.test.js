import {
  INTERIM_THROTTLE_MS,
  CAPTION_ROW_LIMIT,
  buildStableCaptionId,
  createCaptionEngineState,
  mergeCaptionsForUi,
  splitCaptionRows,
  initEngineFromPersisted,
  reduceTranscriptEvent,
  shouldFlushImmediately,
} from "./captionEngine";

describe("captionEngine", () => {
  test("buildStableCaptionId encodes channel start and final flag", () => {
    expect(buildStableCaptionId("en", 1.23, false)).toBe("dg-en-1.23-i");
    expect(buildStableCaptionId("es", 0, true)).toBe("dg-es-0-f");
  });

  test("split and merge round-trip live draft", () => {
    const finals = [{ id: "a", text: "Hello.", isFinal: true }];
    const live = { id: "b", text: "World", isFinal: false };
    const state = splitCaptionRows([...finals, live]);
    expect(state.finals).toHaveLength(1);
    expect(state.liveDraft?.id).toBe("b");
    expect(mergeCaptionsForUi(state)).toEqual([...finals, live]);
  });

  test("initEngineFromPersisted treats all rows as finals when none interim", () => {
    const rows = [{ id: "1", isFinal: true }, { id: "2", isFinal: true }];
    const state = initEngineFromPersisted(rows);
    expect(state.finals).toHaveLength(2);
    expect(state.liveDraft).toBeNull();
  });

  test("reduceTranscriptEvent appends interim live draft without sealing", () => {
    const pair = { left: "en", right: "es" };
    const turnWordsBaseRef = { current: 0 };
    const currentTurnIdRef = { current: null };
    const bubbleIdCounterRef = { current: 0 };
    const lastBubbleStartedRef = { current: 0 };
    const now = Date.now();

    const next = reduceTranscriptEvent(
      [],
      {
        transcript: "hello there",
        isFinal: false,
        speechFinal: false,
        confidence: 0.95,
        laneSide: "en",
        channelKey: "en",
        startTime: 2.5,
        now,
        isSilentBreak: true,
        protectionsOn: true,
        langMode: "auto",
        pair,
      },
      { turnWordsBaseRef, currentTurnIdRef, bubbleIdCounterRef, lastBubbleStartedRef },
    );

    expect(next).toHaveLength(1);
    expect(next[0].isFinal).toBe(false);
    expect(next[0].id).toBe(buildStableCaptionId("en", 2.5, false));
    expect(next[0].isTailMovedSection).toBe(false);
    expect(next[0].text).toMatch(/hello/i);
  });

  test("final event seals and creates explicit tail remainder bubble", () => {
    const pair = { left: "en", right: "es" };
    const turnWordsBaseRef = { current: 0 };
    const currentTurnIdRef = { current: null };
    const bubbleIdCounterRef = { current: 0 };
    const lastBubbleStartedRef = { current: 0 };
    const now1 = Date.now();
    const now2 = now1 + 500;

    // 1) Interim draft
    const interim = reduceTranscriptEvent(
      [],
      {
        transcript: "hello",
        isFinal: false,
        speechFinal: false,
        confidence: 0.95,
        laneSide: "en",
        channelKey: "en",
        startTime: 2.5,
        now: now1,
        isSilentBreak: true,
        protectionsOn: false,
        langMode: "auto",
        pair,
      },
      { turnWordsBaseRef, currentTurnIdRef, bubbleIdCounterRef, lastBubbleStartedRef },
    );

    const interimId = interim[0].id;
    expect(interim[0].isTailMovedSection).toBe(false);

    // 2) Final: one sealed sentence + tail remainder
    const finalRows = reduceTranscriptEvent(
      interim,
      {
        transcript: "Hello. tail",
        isFinal: true,
        speechFinal: false,
        confidence: 0.95,
        laneSide: "en",
        channelKey: "en",
        startTime: 2.5,
        now: now2,
        isSilentBreak: false,
        protectionsOn: false,
        langMode: "auto",
        pair,
      },
      { turnWordsBaseRef, currentTurnIdRef, bubbleIdCounterRef, lastBubbleStartedRef },
    );

    const tailRow = finalRows.find((r) => r.isFinal === false);
    const sealedRows = finalRows.filter((r) => r.isFinal === true);

    expect(sealedRows.length).toBeGreaterThan(0);
    expect(sealedRows.every((r) => r.isTailMovedSection === false)).toBe(true);
    expect(tailRow).toBeTruthy();
    expect(tailRow.isTailMovedSection).toBe(true);
    expect(tailRow.tailMovedFromId).toBe(interimId);
    expect(tailRow.id).not.toBe(interimId);
    expect(tailRow.id).toMatch(/-tail-\d+$/);
  });

  test("shouldFlushImmediately true for is_final or speech_final", () => {
    expect(shouldFlushImmediately(true, false)).toBe(true);
    expect(shouldFlushImmediately(false, true)).toBe(true);
    expect(shouldFlushImmediately(false, false)).toBe(false);
  });

  test("INTERIM_THROTTLE_MS is 150", () => {
    expect(INTERIM_THROTTLE_MS).toBe(150);
  });

  test("mergeCaptionsForUi caps at CAPTION_ROW_LIMIT", () => {
    const finals = Array.from({ length: CAPTION_ROW_LIMIT + 5 }, (_, i) => ({
      id: `f${i}`,
      isFinal: true,
    }));
    const merged = mergeCaptionsForUi({ finals, liveDraft: null });
    expect(merged).toHaveLength(CAPTION_ROW_LIMIT);
  });
});
