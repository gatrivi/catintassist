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
  captionsSnapshotEqual,
} from "./captionEngine";

const makeCtx = () => ({
  turnWordsBaseRef: { current: 0 },
  currentTurnIdRef: { current: null },
  bubbleIdCounterRef: { current: 0 },
  lastBubbleStartedRef: { current: 0 },
});

const makeEvent = (overrides = {}) => ({
  transcript: "hello",
  isFinal: false,
  speechFinal: false,
  confidence: 0.95,
  laneSide: "en",
  channelKey: "en",
  startTime: 2.5,
  now: Date.now(),
  isSilentBreak: true,
  protectionsOn: false,
  langMode: "auto",
  pair: { left: "en", right: "es" },
  ...overrides,
});

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
    const ctx = makeCtx();
    const now = Date.now();

    const next = reduceTranscriptEvent([], makeEvent({ transcript: "hello there", now }), ctx);

    expect(next).toHaveLength(1);
    expect(next[0].isFinal).toBe(false);
    expect(next[0].id).toBe(buildStableCaptionId("en", 2.5, false));
    expect(next[0].tailPreviewText).toBeNull();
    expect(next[0].text).toMatch(/hello/i);
  });

  test("final event seals and creates tail row with tailPreviewText reusing live draft id", () => {
    const ctx = makeCtx();
    const now1 = Date.now();
    const now2 = now1 + 500;

    const interim = reduceTranscriptEvent(
      [],
      makeEvent({ transcript: "hello", now: now1 }),
      ctx,
    );

    const interimId = interim[0].id;
    expect(interim[0].tailPreviewText).toBeNull();

    const finalRows = reduceTranscriptEvent(
      interim,
      makeEvent({
        transcript: "Hello. tail",
        isFinal: true,
        now: now2,
        isSilentBreak: false,
      }),
      ctx,
    );

    const tailRow = finalRows.find((r) => r.isFinal === false);
    const sealedRows = finalRows.filter((r) => r.isFinal === true);

    expect(sealedRows.length).toBeGreaterThan(0);
    expect(sealedRows.every((r) => !r.tailPreviewText)).toBe(true);
    expect(tailRow).toBeTruthy();
    expect(tailRow.tailPreviewText).toBe("tail");
    expect(tailRow.id).toBe(interimId);
  });

  test("tail preview clears on next interim update", () => {
    const ctx = makeCtx();
    const now1 = Date.now();
    const now2 = now1 + 500;
    const now3 = now2 + 200;

    const interim = reduceTranscriptEvent([], makeEvent({ transcript: "hello", now: now1 }), ctx);
    const finalRows = reduceTranscriptEvent(
      interim,
      makeEvent({
        transcript: "Hello. tail",
        isFinal: true,
        now: now2,
        isSilentBreak: false,
      }),
      ctx,
    );

    const tailRow = finalRows.find((r) => r.isFinal === false);
    expect(tailRow.tailPreviewText).toBe("tail");

    const afterInterim = reduceTranscriptEvent(
      finalRows,
      makeEvent({
        transcript: " tail more",
        isFinal: false,
        now: now3,
        isSilentBreak: false,
      }),
      ctx,
    );

    const liveRow = afterInterim.find((r) => r.isFinal === false);
    expect(liveRow?.tailPreviewText).toBeNull();
  });

  test("finalized rows stay immutable across interim updates", () => {
    const ctx = makeCtx();
    const now1 = Date.now();
    const now2 = now1 + 500;
    const now3 = now2 + 200;

    const interim = reduceTranscriptEvent([], makeEvent({ transcript: "hello", now: now1 }), ctx);
    const finalRows = reduceTranscriptEvent(
      interim,
      makeEvent({
        transcript: "Hello. tail",
        isFinal: true,
        now: now2,
        isSilentBreak: false,
      }),
      ctx,
    );

    const sealedSnapshot = finalRows
      .filter((r) => r.isFinal === true)
      .map((r) => ({ id: r.id, text: r.text }));

    const afterInterim = reduceTranscriptEvent(
      finalRows,
      makeEvent({
        transcript: " more words",
        isFinal: false,
        now: now3,
        isSilentBreak: false,
      }),
      ctx,
    );

    const sealedAfter = afterInterim.filter((r) => r.isFinal === true);
    expect(sealedAfter).toHaveLength(sealedSnapshot.length);
    sealedSnapshot.forEach((snap, idx) => {
      expect(sealedAfter[idx].id).toBe(snap.id);
      expect(sealedAfter[idx].text).toBe(snap.text);
    });

    const liveAfter = afterInterim.find((r) => r.isFinal === false);
    expect(liveAfter).toBeTruthy();
    expect(liveAfter.text).not.toBe(finalRows.find((r) => r.isFinal === false)?.text);
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

  test("rapid interim within 400ms on empty prev still opens first bubble", () => {
    const ctx = makeCtx();
    ctx.lastBubbleStartedRef.current = Date.now();
    const now = Date.now() + 50;
    const next = reduceTranscriptEvent(
      [],
      makeEvent({ transcript: "hello", now, isSilentBreak: false }),
      ctx,
    );
    expect(next).toHaveLength(1);
    expect(next[0].text).toMatch(/hello/i);
  });

  test("captionsSnapshotEqual detects live text change", () => {
    const a = [{ id: "1", text: "hi", isFinal: false }];
    const b = [{ id: "1", text: "hi there", isFinal: false }];
    expect(captionsSnapshotEqual(a, a)).toBe(true);
    expect(captionsSnapshotEqual(a, b)).toBe(false);
  });
});
