/**
 * The real call, 2026-09-26 12:11 (interpreter, nurse practitioner + patient).
 *
 * What the operator saw: ONE English bubble holding three different speakers —
 *   "If you could tell me your 1st and last name and date of birth."  (nurse)
 *   "My last name? Okay. Yeah. That he has"                          (patient)
 * ...and then "My last name?" printed AGAIN as its own bubble three seconds
 * later. An interpreter cannot tell who said what, which is the whole job.
 *
 * The split rule today (`startsAfterPeriod`) only fires BETWEEN Deepgram
 * finals. A single payload that already contains a speaker change never splits.
 * These tests pin the behaviour we want, so the fix cannot regress.
 */
import { replayFixtureEvents } from './fixtureReplay';
import { mergeCaptionsForUi, createCaptionEngineState } from './captionEngine';

const run = (events, opts = {}) => {
  const { rows } = replayFixtureEvents(
    { events },
    { engineState: createCaptionEngineState(), rows: mergeCaptionsForUi(createCaptionEngineState()), ...opts },
  );
  return rows.filter((r) => r?.isFinal && (r.text || '').trim());
};

const dgFinal = (transcript, atMs, start = 0.5) => ({
  atMs,
  lane: 'en',
  payload: {
    type: 'Results',
    is_final: true,
    speech_final: true,
    start,
    channel: { alternatives: [{ transcript, confidence: 0.9, words: [] }] },
  },
});

describe('speaker change inside one Deepgram final (v4.160.0)', () => {
  const NURSE_ASK = 'If you could tell me your 1st and last name and date of birth.';
  const PATIENT = 'My last name? Okay. Yeah.';

  test('DEBUG dump', () => {
    const { rows } = replayFixtureEvents({
      events: [dgFinal(`${NURSE_ASK} ${PATIENT}`, 0, 0.5)],
    });
    // eslint-disable-next-line no-console
    console.log('ROWS:', JSON.stringify(rows.map((r) => ({ t: r.text, f: r.isFinal })), null, 1));
  });

  test('a tail ending mid-sentence is sealed when the turn ENDS (never stranded live)', () => {
    // The real defect: "…Okay. Yeah." — the tail stayed `isFinal: false` forever,
    // so its words never reached the sealed transcript and the app's own trace
    // reported them as lost. Silence after a final IS an ending.
    const finals = run([
      dgFinal(`${NURSE_ASK} ${PATIENT}`, 0, 0.5),
      // the speaker simply stops; the next thing said opens a new turn
      dgFinal('Good morning, how are you feeling today?', 4000, 4.0),
    ]);
    const texts = finals.map((f) => f.text);
    expect(texts.some((t) => t.includes('Yeah'))).toBe(true);
    // and nothing is left sitting live with words in it
    const { rows } = replayFixtureEvents({
      events: [
        dgFinal(`${NURSE_ASK} ${PATIENT}`, 0, 0.5),
        dgFinal('Good morning, how are you feeling today?', 4000, 4.0),
      ],
    });
    const stranded = rows.filter((r) => r.isFinal === false && (r.text || '').trim());
    expect(stranded).toEqual([]);
  });

  test('NOT ONE WORD IS LOST once the turn ends (the whole point)', () => {
    const source = `${NURSE_ASK} ${PATIENT}`;
    const finals = run([
      dgFinal(source, 0, 0.5),
      dgFinal('Good morning, how are you feeling today?', 4000, 4.0),
    ]);
    const rejoined = finals
      .map((f) => f.text)
      .join(' ')
      .replace(/[.!?…]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const original = source.replace(/[.!?…]/g, ' ').replace(/\s+/g, ' ').trim();
    expect(rejoined).toContain(original);
  });

  test('the split is per sentence — the app CANNOT know who spoke', () => {
    // Being honest about what is fixable here: there is no diarization, so the
    // app splits on sentence boundaries. That is what makes a nurse question and
    // a patient answer readable as separate bubbles.
    const finals = run([
      dgFinal(`${NURSE_ASK} ${PATIENT}`, 0, 0.5),
      dgFinal('Good morning, how are you feeling today?', 4000, 4.0),
    ]);
    expect(finals.slice(0, 4).map((f) => f.text)).toEqual([
      'If you could tell me your 1st and last name and date of birth.',
      'My last name?',
      'Okay.',
      'Yeah.',
    ]);
  });

  test('digits are never split away from their words (the phone-number promise)', () => {
    const finals = run([dgFinal('My number is 5551234567. Okay, thank you.', 0, 0.5)]);
    const all = finals.map((f) => f.text).join(' ');
    expect(all).toContain('5551234567');
    expect(finals.some((f) => (f.text || '').includes('5551234567'))).toBe(true);
  });

  test('a single-speaker paragraph splits per SENTENCE, never shredding words', () => {
    // One speaker, three sentences. The app splits on sentence boundaries on
    // purpose (v4.123.0: prevents a "wall of text" when a nurse talks straight
    // through). What must never happen is losing or truncating a word.
    const prose =
      'I reviewed the chart this morning and the blood pressure readings were stable. ' +
      'The medication list has been updated and we will continue the same dose. ' +
      'Please return in two weeks for a follow up visit.';
    const finals = run([
      dgFinal(prose, 0, 0.5),
      dgFinal('Good morning, how are you feeling today?', 4000, 4.0),
    ]);
    expect(finals.length).toBe(4);
    expect(finals[2].text).toContain('two weeks');
    const rejoined = finals
      .map((f) => f.text)
      .join(' ')
      .replace(/[.!?…]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(rejoined).toContain(prose.replace(/[.!?…]/g, ' ').replace(/\s+/g, ' ').trim());
  });

  test('a short two-sentence turn stays whole (no busywork bubbles)', () => {
    const finals = run([dgFinal('Okay. Thank you very much.', 0, 0.5)]);
    expect(finals.length).toBe(1);
  });

  test('the split still happens between two Deepgram finals (existing rule intact)', () => {
    const finals = run([
      dgFinal(NURSE_ASK, 0, 0.5),
      dgFinal(PATIENT, 3000, 2.0),
      dgFinal('Good morning, how are you feeling today?', 6000, 5.0),
    ]);
    // 1 sentence + 3 sentences + 1 = every committed word ends up sealed
    expect(finals.length).toBe(5);
    expect(finals[0].text).toBe(NURSE_ASK);
    expect(finals.map((f) => f.text).join(' ')).toContain('Yeah.');
  });
});
