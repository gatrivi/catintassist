/** Caption engine v2 ledger (v4.200.0, Phase A). Plan: docs/development/caption-engine-v2-plan.md */
import {
  createLedger, ledgerApply, ledgerNewEpoch, bubblesFrom, ledgerLoss, replayLedger,
} from './sttLedger';
import { TRANSCRIPTION_FIXTURE_LIST as FIXTURES } from '../fixtures/transcription';
import { EVAL_CASES } from '../fixtures/eval';
import { assertFixtureExpect } from './fixtureReplay';
import { displayTextOf, providerTextOf } from './sttEvalRun';
import { scoreEvalCase } from './sttEval';
import { applyDisplayProtections } from './sensitiveDataProtector';

const msg = (start, transcript, isFinal = true, { duration, lang } = {}) => ({
  type: 'Results', is_final: isFinal, speech_final: false, start,
  ...(duration != null ? { duration } : {}),
  channel: { alternatives: [{ transcript, confidence: 0.9,
    words: transcript.split(' ').map((w) => ({ word: w, confidence: 0.9, ...(lang ? { language: lang } : {}) })) }] },
});
const feed = (list, socket = 'en') =>
  list.reduce((l, m) => ledgerApply(l, m, { socket }), createLedger());
const texts = (rows) => rows.map((r) => r.rawText);

describe('ledger: what Deepgram said, keyed by audio time', () => {
  test('interim replaces the draft at the same start', () => {
    const l = feed([msg(1, 'he has a', false), msg(1, 'he has a fever', false)]);
    expect(l.segments.map((s) => s.text)).toEqual(['he has a fever']);
  });
  test('a final is written once (re-delivery = no-op)', () => {
    const l = feed([msg(1, 'he has a fever.', true), msg(1, 'he has a fever.', true), msg(1, 'other text', false)]);
    expect(l.segments.map((s) => s.text)).toEqual(['he has a fever.']);
  });
  test('a final drops older drafts on its audio', () => {
    const l = feed([msg(1, 'stale draft', false), msg(0.5, 'the real final words here.', true, { duration: 2 })]);
    expect(l.segments.map((s) => s.text)).toEqual(['the real final words here.']);
  });
  test('empty Results never erase a draft', () => {
    const l = feed([msg(1, 'hello there', false), msg(1, '', false)]);
    expect(l.segments).toHaveLength(1);
  });
  test('reconnect: clock restarts → new epoch, nothing overwritten', () => {
    let l = feed([msg(10, 'before the drop.', true, { duration: 2 })]);
    l = ledgerApply(l, msg(0.2, 'after the drop.', true), { socket: 'en' });
    expect(l.segments.map((s) => [s.epoch, s.text])).toEqual([[0, 'before the drop.'], [1, 'after the drop.']]);
    l = ledgerNewEpoch(l, 'en');
    l = ledgerApply(l, msg(0.2, 'third socket.', true), { socket: 'en' });
    expect(l.segments).toHaveLength(3);
  });
});

describe('bubbles: one pure function', () => {
  test('repeated words across a pause stay (the v4.199.0 bug, by design)', () => {
    const rows = bubblesFrom(feed([msg(1, 'I need to see the doctor', true, { duration: 1.5 }),
      msg(2.6, 'the doctor said come back', true, { duration: 1.5 })]));
    expect(texts(rows).join(' ')).toBe('I need to see the doctor the doctor said come back');
  });
  test('a growing number never freezes anything', () => {
    const rows = bubblesFrom(feed([msg(1, 'I am 4', false), msg(1, 'I am 45 years old and I live in Texas', false)]));
    expect(texts(rows).join(' ')).toContain('Texas');
  });
  test('audio silence > gap = new turn', () => {
    const rows = bubblesFrom(feed([msg(1, 'first part', true, { duration: 1 }), msg(5, 'second part', true, { duration: 1 })]));
    expect(rows.map((r) => r.turnId)).toHaveLength(2);
    expect(new Set(rows.map((r) => r.turnId)).size).toBe(2);
  });
  test('sentence end closes a bubble; short "OK." does not stand alone', () => {
    const rows = bubblesFrom(feed([msg(1, 'OK. I will take the pill. And then call you', false)]));
    expect(texts(rows)).toEqual(['OK. I will take the pill.', 'And then call you']);
  });
  test('ids are stable while a draft grows', () => {
    const a = bubblesFrom(feed([msg(1, 'Take two pills. Then rest', false)]));
    const b = bubblesFrom(feed([msg(1, 'Take two pills. Then rest at home', false)]));
    expect(b.map((r) => r.id)).toEqual(a.map((r) => r.id));
  });
  test('multi: neutral digits join the Spanish bubble; real English opens its own', () => {
    const l = [
      msg(0.3, 'Mi número es', true, { duration: 1, lang: 'es' }),
      msg(1.4, '555 123 4567', true, { duration: 1, lang: 'en' }),
      msg(2.5, 'Thank you very much ma\'am', true, { duration: 1, lang: 'en' }),
    ].reduce((x, m) => ledgerApply(x, m, { socket: 'multi' }), createLedger());
    const rows = bubblesFrom(l);
    expect(rows.map((r) => [r.lang, r.rawText])).toEqual([
      ['es', 'Mi número es 555 123 4567'],
      ['en', "Thank you very much ma'am"],
    ]);
  });
  test('✎ override sticks across later packets', () => {
    let l = feed([msg(1, 'he has a fever.', true, { duration: 1 })]);
    const id = bubblesFrom(l)[0].id;
    l = ledgerApply(l, msg(2.1, 'and chills', false), { socket: 'en' });
    const rows = bubblesFrom(l, { overrides: { [id]: 'he has a fervor.' } });
    expect(rows[0].text).toBe('he has a fervor.');
    expect(ledgerLoss(l, rows)).toEqual([]);
  });
  test('row has the fields the board reads', () => {
    const [r] = bubblesFrom(feed([msg(1, 'hola', true)], 'es'));
    expect(r).toMatchObject({ lang: 'es', isFinal: true, esFinalized: 'hola', enFinalized: '' });
  });
});

describe('redundancy: no final word is ever lost (property test)', () => {
  const vocab = ['the', 'doctor', 'said', '555', '123', 'okay.', 'sí', 'dolor', 'pill,', 'no', 'take', 'two.', 'Juan', 'Juan'];
  let seed = 7;
  const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  test.each(Array.from({ length: 40 }, (_, i) => i))('random stream %i', () => {
    let l = createLedger();
    let t = 0;
    for (let i = 0; i < 25; i += 1) {
      const words = Array.from({ length: 1 + rnd(9) }, () => vocab[rnd(vocab.length)]).join(' ');
      const socket = 'multi';
      const lang = rnd(2) ? 'en' : 'es';
      if (rnd(3) === 0) l = ledgerApply(l, msg(t, words, false, { lang }), { socket });
      l = ledgerApply(l, msg(t, words + (rnd(2) ? '.' : ''), true, { duration: 0.5 + rnd(3), lang }), { socket });
      if (rnd(5) === 0) l = ledgerApply(l, msg(t, words, true, { lang }), { socket }); // re-delivery
      t += 0.5 + rnd(4);
    }
    expect(ledgerLoss(l, bubblesFrom(l))).toEqual([]);
  });
});

describe('v1 vs v2 on every fixture (Phase A gate)', () => {
  // interim-rewrite: v1 holds the FIRST heard number (4567) over Deepgram's
  // final (4568). v2 shows the final by design. Listed, not hidden.
  const KNOWN_DIVERGENCE = { 'interim-rewrite': ['missing digits: 5551234567'] };
  // two sockets hear the same audio: v2 targets one socket (plan scope note).
  const singleSocket = (f) => new Set((f.events || []).map((e) => e.lane || 'en')).size <= 1;

  FIXTURES.filter(singleSocket).forEach((f) => {
    test(`fixture ${f.id}`, () => {
      const { rows } = replayLedger(f);
      expect(assertFixtureExpect(rows, f.expect || {}).failures).toEqual(KNOWN_DIVERGENCE[f.id] || []);
    });
  });

  const v2Display = (f) => {
    const lang = f.lang === 'es' ? 'es' : 'en';
    return replayLedger(f).rows.filter((r) => r.isFinal)
      .map((r) => applyDisplayProtections(r.text, lang, { applyNumberWords: lang === 'en' })).join(' ');
  };
  EVAL_CASES.filter((f) => f.events?.length).forEach((f) => {
    test(`eval ${f.id}: v2 damage ≤ v1`, () => {
      const base = { id: f.id, kind: f.kind, lang: f.lang, reference: f.reference,
        hypothesis: providerTextOf(f), terms: f.terms, criticalPhrases: f.criticalPhrases };
      const v1 = scoreEvalCase({ ...base, display: displayTextOf(f) });
      const v2 = scoreEvalCase({ ...base, display: v2Display(f) });
      expect(v2.damage).toBeLessThanOrEqual(v1.damage);
      expect(v2.digits.recall).toBeGreaterThanOrEqual(v1.digits.recall);
      expect(v2.critical.recall).toBeGreaterThanOrEqual(v1.critical.recall);
    });
  });
});
