import {
  INTERIM_THROTTLE_MS,
  CAPTION_ROW_LIMIT,
  RESTART_MIN_WORDS,
  buildStableCaptionId,
  createCaptionEngineState,
  mergeCaptionsForUi,
  restatedHeadWindow,
  splitCaptionRows,
  initEngineFromPersisted,
  reduceTranscriptEvent,
  shouldFlushImmediately,
  captionsSnapshotEqual,
} from "./captionEngine";
import { removeOverlapPreservingDigitSequences } from "./sensitiveDataProtector";

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

  test("reduceTranscriptEvent carries Deepgram word confidence metadata", () => {
    const ctx = makeCtx();
    const next = reduceTranscriptEvent(
      [],
      makeEvent({
        transcript: "hello there",
        words: [
          { word: "hello", confidence: 0.96 },
          { word: "there", confidence: 0.48 },
        ],
      }),
      ctx,
    );

    expect(next[0].wordConfidence).toEqual([
      { word: "hello", confidence: 0.96 },
      { word: "there", confidence: 0.48 },
    ]);
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

  test("captionsSnapshotEqual detects confidence-only changes", () => {
    const a = [{ id: "1", text: "hi", isFinal: false, wordConfidence: [{ word: "hi", confidence: 0.9 }] }];
    const b = [{ id: "1", text: "hi", isFinal: false, wordConfidence: [{ word: "hi", confidence: 0.5 }] }];
    expect(captionsSnapshotEqual(a, b)).toBe(false);
  });

  test("mergeCaptionsForUi makes duplicate ids unique", () => {
    const rows = mergeCaptionsForUi({
      finals: [{ id: "dg-en-1-i", isFinal: true }, { id: "dg-en-1-i", isFinal: true }],
      liveDraft: { id: "dg-en-1-i", isFinal: false },
    });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  // v4.93.2: blank live drafts must never reach the UI (CPU freeze fix)
  test("mergeCaptionsForUi drops blank live draft", () => {
    const finals = [{ id: "a", text: "Hello.", isFinal: true }];
    const blank = { id: "b", isFinal: false, enFinalized: "", enInterim: "" };
    const merged = mergeCaptionsForUi({ finals, liveDraft: blank });
    expect(merged).toEqual(finals);
  });

  test("reduceTranscriptEvent drops freshly appended blank draft on overlap_empty_freeze", () => {
    const ctx = makeCtx();
    // First event with empty transcript after silence creates a new blank draft,
    // overlap cleaner empties it -> freeze branch must drop the blank row.
    const state1 = reduceTranscriptEvent([], makeEvent({ transcript: "hello", isSilentBreak: true }), ctx);
    expect(state1[state1.length - 1].id).toBeTruthy();
    // Simulate a later event whose cleaned text comes out empty on a fresh bubble.
    const state2 = reduceTranscriptEvent([], makeEvent({ transcript: "", isSilentBreak: true }), ctx);
    const texts = state2.map((c) => (c.text || "").trim());
    expect(texts.every(Boolean)).toBe(true);
    expect(state2.filter((c) => !c.text?.trim())).toHaveLength(0);
  });
  // v4.123.0: sentence-final punctuation on the sealed lane starts a new bubble
  test("final after sealed period opens a new bubble (nurse tirade split)", () => {
    const ctx = makeCtx();
    const now1 = Date.now();
    const now2 = now1 + 2000;

    const first = reduceTranscriptEvent(
      [],
      makeEvent({ transcript: "Take the medication twice daily.", isFinal: true, now: now1 }),
      ctx,
    );
    const second = reduceTranscriptEvent(
      first,
      makeEvent({
        transcript: "If the fever continues call us.",
        isFinal: true,
        now: now2,
        isSilentBreak: false,
      }),
      ctx,
    );

    const sealed = second.filter((r) => r.isFinal === true);
    expect(sealed.length).toBeGreaterThanOrEqual(2);
    expect(second.map((r) => r.text).join(" ")).toMatch(/fever continues/i);
  });

  test("final after mid-sentence fragment merges into same bubble", () => {
    const ctx = makeCtx();
    const now1 = Date.now();
    const now2 = now1 + 2000;

    const first = reduceTranscriptEvent(
      [],
      makeEvent({ transcript: "Take the medication", isFinal: true, now: now1 }),
      ctx,
    );
    const second = reduceTranscriptEvent(
      first,
      makeEvent({
        transcript: "twice daily with food",
        isFinal: true,
        now: now2,
        isSilentBreak: false,
      }),
      ctx,
    );

    const enRows = second.filter((r) => (r.text || "").includes("medication"));
    expect(enRows).toHaveLength(1);
    expect(enRows[0].text).toMatch(/twice daily/i);
  });

  // v4.136.0: the losing lane may be the only one that heard the zip — a lane
  // flip that drops a digit run must keep the visible text instead.
  describe("lane flip digit guard", () => {
    test("keeps zip when longer es lane lacks it", () => {
      const ctx = makeCtx();
      const now = Date.now();
      const state1 = reduceTranscriptEvent(
        [],
        makeEvent({ transcript: "my zip is 93550", isFinal: true, now, isSilentBreak: false }),
        ctx,
      );
      expect(state1[0].text).toMatch(/93550/);

      const state2 = reduceTranscriptEvent(
        state1,
        makeEvent({
          transcript: "el paciente vive cerca del hospital grande",
          laneSide: "es",
          channelKey: "es",
          isFinal: true,
          now: now + 2000,
          isSilentBreak: false,
        }),
        ctx,
      );
      expect(state2[0].text).toMatch(/93550/);
    });

    test("still flips lanes when no digits are lost", () => {
      const ctx = makeCtx();
      const now = Date.now();
      const state1 = reduceTranscriptEvent(
        [],
        makeEvent({ transcript: "hello there friend", isFinal: true, now, isSilentBreak: false }),
        ctx,
      );

      const state2 = reduceTranscriptEvent(
        state1,
        makeEvent({
          transcript: "buenos dias señor gracias por venir",
          laneSide: "es",
          channelKey: "es",
          isFinal: true,
          now: now + 2000,
          isSilentBreak: false,
        }),
        ctx,
      );
      expect(state2[0].text).toMatch(/buenos dias/i);
    });
  });

  // ---------------------------------------------------------------------------
  // v4.141.0 — restarted segment (Deepgram re-delivers a phrase it already
  // finalized on the same lane). Two hard rules, both from the booth:
  //   1. nothing is deleted, ever (the engine only ROUTES, never strips here);
  //   2. the repeated fragment may never appear twice inside ONE row.
  // ---------------------------------------------------------------------------
  describe("restarted segment split (v4.141.0)", () => {
    const t0 = 1_700_000_000_000;
    const FIRST = "Yourself, Anna, and is there anybody else?";
    const FIRST_TAIL = "Can you provide me with their first names, if";
    const RESTART = "Can you provide me with their 1st names if so?";

    const textsOf = (rows) => rows.map((r) => r.text || "");
    const rowsContaining = (rows, needle) =>
      rows.filter((r) => (r.text || "").includes(needle));

    /** Runs of >= minWords words that occur more than once inside ONE row. */
    const runsRepeatedTwice = (text, minWords = 4) => {
      const w = String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const seen = new Map();
      for (let i = 0; i + minWords <= w.length; i += 1) {
        const key = w.slice(i, i + minWords).join(" ");
        seen.set(key, (seen.get(key) || 0) + 1);
      }
      return [...seen.entries()].filter(([, n]) => n > 1).map(([key]) => key);
    };

    /** The reported sequence: interim → final (leaves a mid-sentence tail) → restarting interim. */
    const runRestartSequence = (laneOverrides = {}) => {
      const ctx = makeCtx();
      let rows = reduceTranscriptEvent(
        [],
        makeEvent({ transcript: FIRST, startTime: 10, now: t0, isSilentBreak: true, ...laneOverrides }),
        ctx,
      );
      rows = reduceTranscriptEvent(
        rows,
        makeEvent({
          transcript: `${FIRST} ${FIRST_TAIL}`,
          isFinal: true,
          speechFinal: true,
          startTime: 10,
          now: t0 + 1200,
          isSilentBreak: false,
          ...laneOverrides,
        }),
        ctx,
      );
      rows = reduceTranscriptEvent(
        rows,
        makeEvent({ transcript: RESTART, startTime: 12, now: t0 + 2000, isSilentBreak: false, ...laneOverrides }),
        ctx,
      );
      return { ctx, rows };
    };

    test("restatedHeadWindow measures the repeating head, 0 for a plain continuation", () => {
      expect(restatedHeadWindow(FIRST_TAIL, RESTART)).toBe(6);
      expect(restatedHeadWindow(FIRST, `${FIRST} ${FIRST_TAIL}`)).toBe(7);
      expect(restatedHeadWindow("And who do I need to update the address for?", "and who do I need to update the address for? Yourself")).toBe(10);
      // Too short to be a restatement / different wording / no base at all.
      expect(restatedHeadWindow("hello there friend", "hello there")).toBe(0);
      expect(restatedHeadWindow("Take the medication", "twice daily with food")).toBe(0);
      expect(restatedHeadWindow("", RESTART)).toBe(0);
      expect(RESTART_MIN_WORDS).toBe(4);
    });

    test("screenshot string: fragment never twice in one row, every word kept", () => {
      const { rows } = runRestartSequence();
      const texts = textsOf(rows);

      // BEFORE v4.141.0 this was ONE row holding both copies:
      // "…their first names, if Can you provide me with their 1st names if so?"
      expect(texts).not.toContain(`${FIRST_TAIL} ${RESTART}`);
      texts.forEach((t) => expect(runsRepeatedTwice(t)).toEqual([]));

      // Each delivered segment owns exactly one row: nothing is on screen twice.
      expect(rowsContaining(rows, FIRST_TAIL)).toHaveLength(1);
      expect(rowsContaining(rows, RESTART)).toHaveLength(1);

      // Nothing was deleted or rewritten: both copies are on screen verbatim.
      expect(texts).toContain(FIRST_TAIL);
      expect(texts).toContain(RESTART);
    });

    test("the restart seals on its own final — one clean row per sentence", () => {
      const { ctx, rows } = runRestartSequence();
      const after = reduceTranscriptEvent(
        rows,
        makeEvent({
          transcript: RESTART,
          isFinal: true,
          speechFinal: true,
          startTime: 12,
          now: t0 + 2400,
          isSilentBreak: false,
        }),
        ctx,
      );

      expect(after.filter((r) => r.isFinal === true).map((r) => r.text)).toEqual([
        FIRST,
        FIRST_TAIL,
        RESTART,
      ]);
      // No live draft left behind, and no third copy of the restart.
      expect(after.filter((r) => r.isFinal === false)).toHaveLength(0);
      after.forEach((r) => expect(runsRepeatedTwice(r.text)).toEqual([]));
    });

    test("mirrored on the ES lane — same split, same wording", () => {
      const { rows } = runRestartSequence({ laneSide: "es", channelKey: "es" });
      const texts = textsOf(rows);

      texts.forEach((t) => expect(runsRepeatedTwice(t)).toEqual([]));
      expect(rowsContaining(rows, FIRST_TAIL)).toHaveLength(1);
      expect(rowsContaining(rows, RESTART)).toHaveLength(1);
      expect(rows.every((r) => !r.enFinalized)).toBe(true);
    });

    test("digit runs survive a restart: never dropped, never doubled inside a row", () => {
      const ctx = makeCtx();
      const base = "the number is 555 123 4567 and";
      const restart = "the number is 555 123 4567 and I will call you back";

      let rows = reduceTranscriptEvent(
        [],
        makeEvent({ transcript: base, isFinal: true, now: t0, isSilentBreak: true }),
        ctx,
      );
      rows = reduceTranscriptEvent(
        rows,
        makeEvent({ transcript: restart, startTime: 12, now: t0 + 2000, isSilentBreak: false }),
        ctx,
      );

      const perRowDigitRuns = textsOf(rows).map(
        (t) => (t.replace(/\D/g, "").match(/5551234567/g) || []).length,
      );
      // Once per delivered copy, never twice in the same line.
      expect(perRowDigitRuns.filter((n) => n > 0)).toHaveLength(2);
      perRowDigitRuns.forEach((n) => expect(n).toBeLessThanOrEqual(1));
      expect(textsOf(rows).join(" ").replace(/\D/g, "")).toContain("5551234567");
    });

    test("suffix repeats the overlap guard already cleans are NOT split", () => {
      const ctx = makeCtx();
      let rows = reduceTranscriptEvent(
        [],
        makeEvent({ transcript: "the patient says his name is Robert", isFinal: true, now: t0, isSilentBreak: true }),
        ctx,
      );
      rows = reduceTranscriptEvent(
        rows,
        makeEvent({
          transcript: "his name is Robert and he is here",
          isFinal: true,
          speechFinal: true,
          startTime: 5,
          now: t0 + 2000,
          isSilentBreak: false,
        }),
        ctx,
      );

      const hits = rowsContaining(rows, "Robert");
      expect(hits).toHaveLength(1);
      expect(hits[0].text).toBe("the patient says his name is Robert and he is here");
    });

    test("overlap guard deletions are unchanged (no new stripping anywhere)", () => {
      // These are exactly the boundaries the guard refuses to clean today
      // (v4.116.0 digits / v4.133.0 clinical + emphasis repeats). The restart
      // split must not turn any of them into a deletion.
      const untouched = [
        ["she has no fever and the address is", "no fever and the address is 42 Main"],
        ["epinephrine epinephrine", "epinephrine epinephrine again"],
        ["take the medication twice daily", "twice daily with food"],
        ["the number is 555 123 4567 and", "the number is 555 123 4567 and I will call you back"],
      ];
      untouched.forEach(([base, addition]) => {
        expect(removeOverlapPreservingDigitSequences(base, addition)).toBe(addition);
      });
      // …and the one it does clean still gets cleaned (no split takes over).
      expect(
        removeOverlapPreservingDigitSequences(
          "the patient says his name is Robert",
          "his name is Robert and he is here",
        ),
      ).toBe("and he is here");
    });

    test("live draft + its own final no longer renders the same sentence twice", () => {
      const ctx = makeCtx();
      let rows = reduceTranscriptEvent(
        [],
        makeEvent({ transcript: "How are you feeling today?", now: t0, isSilentBreak: true }),
        ctx,
      );
      rows = reduceTranscriptEvent(
        rows,
        makeEvent({
          transcript: "How are you feeling today?",
          isFinal: true,
          speechFinal: true,
          now: t0 + 800,
          isSilentBreak: false,
        }),
        ctx,
      );

      expect(rows.filter((r) => (r.text || "").trim())).toHaveLength(1);
      expect(rows.filter((r) => r.isFinal === true)).toHaveLength(1);
    });
  });
});
