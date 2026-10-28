/**
 * v4.196.0 — transcription engine Phase 1 (docs/development/transcription-engine-diagnosis.md).
 * One test block per flaw so a regression names the flaw it reopened.
 */
import {
  applyUserCorrectionToCaption,
  userCorrectionPatch,
  patchEngineCaption,
  mergeCaptionsForUi,
} from './captionEngine';
import { replayFixtureEvents } from './fixtureReplay';
import {
  hallucinationGuard,
  removeOverlapPreservingDigitSequences,
  foldSpanishSpokenMoney,
  applyDisplayProtections,
  expandBareTimes,
  isRepeatedProperName,
} from './sensitiveDataProtector';
import { saveCorrection, applySttCorrections, CORRECTIONS_STORAGE_KEY } from './transcriptCorrections';

const PAIR = { left: 'en', right: 'es' };

describe('flaw 4: ✎ correction sticks on the live bubble', () => {
  test('writes the lane buffers, clears drafts', () => {
    const cap = { id: 'a', lang: 'en', text: 'take albuterol roll', enFinalized: 'take albuterol', enInterim: 'roll', esFinalized: '', esInterim: '' };
    const out = applyUserCorrectionToCaption(cap, 'take albuterol now', cap.text, PAIR);
    expect(out.text).toBe('take albuterol now');
    expect(out.enFinalized).toBe('take albuterol now');
    expect(out.enInterim).toBe('');
    expect(out.userCorrected).toBe(true);
  });

  test('ES bubble lands in the es lane', () => {
    const cap = { id: 'b', lang: 'es', text: 'hola', enFinalized: '', enInterim: '', esFinalized: 'hola', esInterim: '' };
    const out = applyUserCorrectionToCaption(cap, 'hola Juan', 'hola', PAIR);
    expect(out.esFinalized).toBe('hola Juan');
    expect(out.enFinalized).toBe('');
  });
});

describe('flaw 5: corrections do not leak across bubbles', () => {
  beforeEach(() => localStorage.removeItem(CORRECTIONS_STORAGE_KEY));

  test('a number fix stays in its bubble', () => {
    saveCorrection({ sourceHeard: 'he has ten', corrected: 'he has twenty', lang: 'en' });
    expect(applySttCorrections('he has ten', 'en')).toBe('he has twenty'); // exact = same bubble
    expect(applySttCorrections('he has ten dollars', 'en')).toBe('he has ten dollars');
  });

  test('a digit fix stays in its bubble', () => {
    saveCorrection({ sourceHeard: 'room 12', corrected: 'room 21', lang: 'en' });
    expect(applySttCorrections('go to room 12 now', 'en')).toBe('go to room 12 now');
  });

  test('a short single word is never taught globally', () => {
    saveCorrection({ sourceHeard: 'an', corrected: 'Ann', lang: 'en' });
    expect(applySttCorrections('an apple', 'en')).toBe('an apple');
  });

  test('a real term still teaches (albuterol)', () => {
    saveCorrection({ sourceHeard: 'all butter all', corrected: 'albuterol', lang: 'en' });
    expect(applySttCorrections('use the all butter all inhaler', 'en')).toBe('use the albuterol inhaler');
  });
});

describe('flaw 3: repeated proper names survive dedupe', () => {
  test('es Juan, Juan Perez', () => {
    expect(hallucinationGuard('es Juan, Juan Perez')).toBe('es Juan, Juan Perez');
  });
  test('my name is David, David Smith', () => {
    expect(hallucinationGuard('my name is David, David Smith')).toBe('my name is David, David Smith');
  });
  test('plain stutter still dedupes', () => {
    expect(hallucinationGuard('take the the pills')).toBe('take the pills');
  });
  test('sentence-start repeat after a period still dedupes', () => {
    expect(isRepeatedProperName('The.', 'The')).toBe(false);
  });
  test('name echo across chunks is kept', () => {
    expect(removeOverlapPreservingDigitSequences('es Juan,', 'Juan Perez')).toBe('Juan Perez');
  });
});

describe('flaw 6: Spanish spoken money folds', () => {
  test.each([
    ['cuesta ciento cincuenta pesos', 'cuesta 150 pesos'],
    ['son dos mil quinientos dólares', 'son 2500 dólares'],
    ['treinta y cinco dolares', '35 dolares'],
    ['veinte pesos', '20 pesos'],
  ])('%s', (input, expected) => {
    expect(foldSpanishSpokenMoney(input)).toBe(expected);
  });
  test.each([
    'uno nunca sabe',
    'tengo dos hijos',
    'a las tres y media',
  ])('no currency → unchanged: %s', (input) => {
    expect(foldSpanishSpokenMoney(input)).toBe(input);
  });
  test('wired into the ES display pipeline', () => {
    expect(applyDisplayProtections('son ciento cincuenta pesos', 'es', { applyNumberWords: false, allowDigitRewrites: true, expectedType: null }))
      .toContain('150 pesos');
  });
});

describe('flaw 7: more clock cues', () => {
  test('come by 3 30', () => expect(expandBareTimes('come by 3 30')).toBe('come by 3:30'));
  test('price with "about" stays a price (no clock cue)', () => {
    expect(applyDisplayProtections("it's about one fifty", 'en', { allowDigitRewrites: true, expectedType: null }))
      .not.toContain(':');
  });
});

describe('flaw 4 end-to-end: next packet does not revert the fix', () => {
  const ev = (atMs, start, transcript, isFinal) => ({
    atMs,
    lane: 'en',
    payload: {
      type: 'Results', is_final: isFinal, speech_final: false, start, duration: 1,
      channel: { alternatives: [{ transcript, confidence: 0.95,
        words: transcript.split(' ').map((w) => ({ word: w, confidence: 0.95 })) }] },
    },
  });

  const run = (fixRow) => {
    const first = replayFixtureEvents({ events: [
      ev(0, 1, 'She takes all butter all daily.', true),
      ev(300, 3, 'and the', false),
    ] });
    const target = first.rows.find((r) => /butter/.test(r.text));
    let engineState = first.engineState;
    if (fixRow) {
      engineState = patchEngineCaption(engineState, target.id,
        userCorrectionPatch(target, 'She takes albuterol daily.', target.text, PAIR));
    }
    const second = replayFixtureEvents({ events: [ev(600, 3, 'and the inhaler', false)] },
      { engineState, rows: mergeCaptionsForUi(engineState), refs: first.refs, baseNow: 1_700_000_000_600 });
    return second.rows.map((r) => r.text);
  };

  test('without the engine patch the fix is lost (the old bug)', () => {
    expect(run(false).join(' ')).not.toContain('albuterol');
  });
  test('with the engine patch the fix survives the next packet', () => {
    const texts = run(true);
    expect(texts.join(' ')).toContain('She takes albuterol daily.');
    expect(texts.join(' ')).not.toContain('butter');
  });
  test('patch on an unknown id is a no-op', () => {
    const st = { finals: [{ id: 'x', text: 'a' }], liveDraft: null };
    expect(patchEngineCaption(st, 'nope', { text: 'b' })).toBe(st);
  });
});

describe('flaw 8 (v4.197.0): 9 digits are SSN-shaped only with a cue', () => {
  const show = (t, lang = 'en') => applyDisplayProtections(t, lang, { allowDigitRewrites: true, expectedType: null });
  test('SSN cue → NNN-NN-NNNN', () => expect(show('my social is 123456789')).toContain('123-45-6789'));
  test('no cue → neutral NNN NNN NNN, every digit kept', () => {
    const out = show('the code is 612345678');
    expect(out).toContain('612 345 678');
    expect(out).not.toContain('612-34-5678');
  });
  test('10-digit phone unchanged', () => expect(show('call 5551234567')).toContain('555-123-4567'));
});

describe('turn end (v4.197.0)', () => {
  const { isTurnBreak, isUtteranceEndMessage } = require('./turnEnd');
  const { buildListenUrl } = require('./deepgramListenConfig');
  test('switch off = old 2.5 s rule', () => {
    expect(isTurnBreak({ gapMs: 2600, switchOn: false, utteranceEndedSinceLast: false })).toBe(true);
    expect(isTurnBreak({ gapMs: 2000, switchOn: false, utteranceEndedSinceLast: true })).toBe(false);
  });
  test('switch on = audio silence decides; wall gap is only the 8 s net', () => {
    expect(isTurnBreak({ gapMs: 3000, switchOn: true, utteranceEndedSinceLast: false })).toBe(false);
    expect(isTurnBreak({ gapMs: 300, switchOn: true, utteranceEndedSinceLast: true })).toBe(true);
    expect(isTurnBreak({ gapMs: 9000, switchOn: true, utteranceEndedSinceLast: false })).toBe(true);
  });
  test('UtteranceEnd message detected', () => {
    expect(isUtteranceEndMessage({ type: 'UtteranceEnd', last_word_end: 2.3 })).toBe(true);
    expect(isUtteranceEndMessage({ type: 'Results' })).toBe(false);
  });
  test('URL: off = unchanged, on = utterance_end_ms appended', () => {
    const off = buildListenUrl('multi', 'fast', {});
    expect(off).not.toContain('utterance_end_ms');
    expect(buildListenUrl('multi', 'fast', { utteranceEnd: true })).toBe(`${off}&utterance_end_ms=1000`);
  });
});
