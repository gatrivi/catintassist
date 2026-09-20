import { applyDeepgramTranscriptPayload } from "./applyDeepgramTranscriptPayload";
import { createCaptionEngineState } from "./captionEngine";
import {
  replayFixtureEvents,
  assertFixtureExpect,
  createReplayCtxRefs,
} from "./fixtureReplay";
import {
  TRANSCRIPTION_FIXTURE_LIST,
  getTranscriptionFixture,
} from "../fixtures/transcription";

describe("applyDeepgramTranscriptPayload", () => {
  test("is stateful-pure: empty transcript returns null", () => {
    const refs = createReplayCtxRefs();
    const out = applyDeepgramTranscriptPayload({
      engineState: createCaptionEngineState(),
      payload: { is_final: false, channel: { alternatives: [{ transcript: "  " }] } },
      lane: "en",
      ctxMeta: { pair: { left: "en", right: "es" }, ...refs },
    });
    expect(out).toBeNull();
  });

  test("interim then final seals through reduceTranscriptEvent", () => {
    const refs = createReplayCtxRefs();
    let engine = createCaptionEngineState();
    let rows;

    const interim = applyDeepgramTranscriptPayload({
      engineState: engine,
      payload: {
        is_final: false,
        speech_final: false,
        start: 1,
        channel: {
          alternatives: [{ transcript: "hello there", confidence: 0.9, words: [] }],
        },
      },
      lane: "en",
      ctxMeta: {
        pair: { left: "en", right: "es" },
        now: 1000,
        isSilentBreak: true,
        protectionsOn: false,
        ...refs,
      },
    });
    expect(interim).not.toBeNull();
    expect(interim.debug.isFinal).toBe(false);
    engine = interim.nextEngineState;
    rows = interim.nextRows;

    const final = applyDeepgramTranscriptPayload({
      engineState: engine,
      rows,
      payload: {
        is_final: true,
        speech_final: true,
        start: 1,
        channel: {
          alternatives: [{ transcript: "hello there friend", confidence: 0.95, words: [] }],
        },
      },
      lane: "en",
      ctxMeta: {
        pair: { left: "en", right: "es" },
        now: 1400,
        isSilentBreak: false,
        protectionsOn: false,
        ...refs,
      },
    });
    expect(final).not.toBeNull();
    expect(final.debug.isFinal || final.debug.speechFinal).toBe(true);
    const sealed = final.nextRows.filter((r) => r.isFinal);
    expect(sealed.length).toBeGreaterThanOrEqual(1);
    expect(sealed.some((r) => /hello/i.test(r.text))).toBe(true);
  });
});

describe("fixtureReplay", () => {
  test("phone-number: interim steps then preserves fake digits", () => {
    const fixture = getTranscriptionFixture("phone-number");
    expect(fixture).toBeTruthy();
    const { rows, steps } = replayFixtureEvents(fixture);
    const interimCount = steps.filter((s) => s.interim).length;
    const finalCount = steps.filter((s) => s.final).length;
    expect(interimCount).toBeGreaterThanOrEqual(2);
    expect(finalCount).toBeGreaterThanOrEqual(1);

    const result = assertFixtureExpect(rows, fixture.expect);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(result.failures, result.allText);
    }
  });

  test("medication-dosage: interim correction then preserves 500", () => {
    const fixture = getTranscriptionFixture("medication-dosage");
    const { rows, steps } = replayFixtureEvents(fixture);
    expect(steps.filter((s) => s.interim).length).toBeGreaterThanOrEqual(2);
    const result = assertFixtureExpect(rows, fixture.expect);
    expect(result.ok).toBe(true);
  });

  test("interim-rewrite: same row is rewritten in place, digits never vanish (v4.140.0)", () => {
    const fixture = getTranscriptionFixture("interim-rewrite");
    expect(fixture).toBeTruthy();
    const seen = [];
    const { rows } = replayFixtureEvents(fixture, {
      onStep: ({ index, rows: stepRows }) => {
        const live = stepRows.filter((r) => !r.isFinal).pop() || stepRows[stepRows.length - 1];
        if (live) seen.push({ index, id: live.id, text: live.text || "" });
      },
    });

    // Two revisions of the SAME speech stay on ONE row id. That is exactly why
    // the swap is a display concern (StableTextMorph) and not a remount: the row
    // the interpreter is reading is the same row after the rewrite.
    const fever = seen.find((s) => s.text.includes("fever"));
    const headache = seen.find((s) => s.text.includes("headache"));
    expect(fever).toBeTruthy();
    expect(headache).toBeTruthy();
    expect(headache.id).toBe(fever.id);

    // The engine really does drop the superseded wording, so the display layer
    // is the only thing keeping it readable for the interpreter.
    expect(headache.text).not.toContain("fever");

    // Numbers are the exception on purpose: the 0.97-confidence rewrite of the
    // last digit is refused and the digits already on screen are kept (v4.136.0
    // guard — "digits already shown must never vanish").
    expect(seen.some((s) => s.text.includes("555 123 4567"))).toBe(true);
    expect(rows.some((r) => r.text.includes("555"))).toBe(true);

    const result = assertFixtureExpect(replayFixtureEvents(fixture).rows, fixture.expect);
    expect(result.failures).toEqual([]);
  });

  test("all registered fixtures replay without throw", () => {
    for (const fixture of TRANSCRIPTION_FIXTURE_LIST) {
      const { rows, steps } = replayFixtureEvents(fixture);
      expect(steps.length).toBe(fixture.events.length);
      if (fixture.expect) {
        const result = assertFixtureExpect(rows, fixture.expect);
        expect(result.failures).toEqual([]);
      }
    }
  });
});
