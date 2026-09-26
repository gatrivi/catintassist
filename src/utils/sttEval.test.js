/**
 * STT eval metrics (v4.154.0). The math must be right before any number in a
 * report can be believed.
 */
import {
  alignWords,
  normalizeForScoring,
  tokenizeForScoring,
  digitRuns,
  hasPhrase,
  wordErrorRate,
  termAccuracy,
  digitRunAccuracy,
  criticalPhraseRecall,
  scoreEvalCase,
  summarizeEval,
  renderEvalReport,
} from './sttEval';

describe('alignWords', () => {
  test('identical words cost nothing', () => {
    expect(alignWords(['a', 'b'], ['a', 'b']).distance).toBe(0);
  });

  test('substitution, deletion and insertion each cost one', () => {
    expect(alignWords(['a', 'b'], ['a', 'x']).distance).toBe(1);
    expect(alignWords(['a', 'b'], ['a']).distance).toBe(1);
    expect(alignWords(['a'], ['a', 'b']).distance).toBe(1);
  });

  test('backtrace reports the op kinds', () => {
    const { ops } = alignWords(['denies', 'chest'], ['chest']);
    expect(ops.map((o) => o.op)).toEqual(['del', 'ok']);
    const sub = alignWords(['exhibit'], ['exit bit']);
    expect(sub.ops[0].op).toBe('sub');
  });
});

describe('normalizeForScoring', () => {
  test('drops punctuation and case', () => {
    expect(normalizeForScoring('Take TWO, pills.')).toBe('take 2 pills');
  });

  test('folds number words on both sides so formatting is not an error', () => {
    // Per-word fold: Deepgram's numerals=true does the "five hundred" -> 500
    // part for us, so the corpus references are written in digits.
    expect(normalizeForScoring('five hundred milligrams')).toBe('5 hundred milligrams');
    expect(normalizeForScoring('take two mg')).toBe('take 2 mg');
  });

  test('undoes our own phone grouping', () => {
    expect(normalizeForScoring('call 555-123-4567 now')).toBe('call 5551234567 now');
    expect(normalizeForScoring('call 555.123.4567 now')).toBe('call 5551234567 now');
  });

  test('strips fillers from both sides', () => {
    expect(normalizeForScoring('um, I mean, give it')).toBe('give it');
  });
});

describe('wordErrorRate', () => {
  test('perfect transcript is zero', () => {
    const r = wordErrorRate({ reference: 'the patient denies pain', hypothesis: 'the patient denies pain' });
    expect(r.wer).toBe(0);
    expect(r.errors).toBe(0);
  });

  test('a dropped negation is one error and is visible in the ops', () => {
    const r = wordErrorRate({ reference: 'the patient denies pain', hypothesis: 'the patient pain' });
    expect(r.errors).toBe(1);
    expect(r.ops.find((o) => o.op === 'del')?.ref).toBe('denies');
  });

  test('empty reference does not divide by zero', () => {
    expect(wordErrorRate({ reference: '', hypothesis: '' }).wer).toBe(0);
    expect(wordErrorRate({ reference: '', hypothesis: 'hello' }).wer).toBe(1);
  });
});

describe('termAccuracy', () => {
  test('a surviving term counts, a mangled one does not', () => {
    const good = termAccuracy({ reference: 'give albuterol now', hypothesis: 'give albuterol now', terms: ['albuterol'] });
    expect(good.accuracy).toBe(1);
    const bad = termAccuracy({ reference: 'give albuterol now', hypothesis: 'give all but a roll now', terms: ['albuterol'] });
    expect(bad.accuracy).toBe(0);
    expect(bad.missed).toEqual(['albuterol']);
  });

  test('word boundaries: "mg" never matches "mgdl"', () => {
    expect(hasPhrase('mgdl only', 'mg')).toBe(false);
    expect(hasPhrase('give 5 mg now', 'mg')).toBe(true);
    const r = termAccuracy({ reference: 'give 5 mg', hypothesis: 'give mgdl', terms: ['mg'] });
    expect(r.accuracy).toBe(0);
  });

  test('an invented term is reported, not counted as a hit (keyterm force-fitting)', () => {
    const r = termAccuracy({ reference: 'give the inhaler', hypothesis: 'give albuterol the inhaler', terms: ['albuterol'] });
    expect(r.invented).toEqual(['albuterol']);
    // Nothing was expected, so accuracy has nothing to measure.
    expect(r.accuracy).toBe(1);
  });

  test('no terms = nothing to measure, never a false failure', () => {
    expect(termAccuracy({ reference: 'a', hypothesis: 'b', terms: [] }).accuracy).toBe(1);
  });
});

describe('digitRunAccuracy', () => {
  test('dose digits survive', () => {
    const r = digitRunAccuracy({ reference: 'take 500 mg', hypothesis: 'take 500 mg' });
    expect(r.recall).toBe(1);
  });

  test('a lost digit run is a recall failure and is named', () => {
    const r = digitRunAccuracy({ reference: 'metformin 500 mg twice', hypothesis: 'metformin 50 mg twice' });
    expect(r.recall).toBeLessThan(1);
    expect(r.missed).toContain('500');
  });

  test('invented numbers are reported', () => {
    const r = digitRunAccuracy({ reference: 'take the inhaler', hypothesis: 'take 3 puffs' });
    expect(r.invented).toContain('3');
  });

  test('grouped and ungrouped digits compare equal', () => {
    expect(digitRunAccuracy({ reference: 'call 5551234567', hypothesis: 'call 555-123-4567' }).recall).toBe(1);
    expect(digitRuns('128 over 82, hr 96')).toEqual(['128', '82', '96']);
  });
});

describe('criticalPhraseRecall', () => {
  test('negation kept = 1, negation lost = 0', () => {
    expect(
      criticalPhraseRecall({ reference: 'denies chest pain', hypothesis: 'denies chest pain', phrases: ['denies'] }).recall,
    ).toBe(1);
    const dropped = criticalPhraseRecall({
      reference: 'denies chest pain',
      hypothesis: 'chest pain',
      phrases: ['denies'],
    });
    expect(dropped.recall).toBe(0);
    expect(dropped.dropped).toEqual(['denies']);
  });

  test('phrases absent from the reference are not held against the hypothesis', () => {
    expect(
      criticalPhraseRecall({ reference: 'chest pain', hypothesis: 'chest pain', phrases: ['denies'] }).total,
    ).toBe(0);
  });

  test('Spanish negations behave the same', () => {
    expect(
      criticalPhraseRecall({ reference: 'niega dolor', hypothesis: 'niega dolor', phrases: ['niega'] }).recall,
    ).toBe(1);
  });
});

describe('scoreEvalCase + damage', () => {
  const base = {
    id: 'x',
    kind: 'medical',
    reference: 'The patient denies chest pain.',
    hypothesis: 'The patient denies chest pain.',
  };

  test('a healthy pipeline has damage 0', () => {
    const c = scoreEvalCase({ ...base, display: base.hypothesis, criticalPhrases: ['denies'] });
    expect(c.damage).toBe(0);
    expect(c.displayRate.wer).toBe(0);
    expect(c.critical.recall).toBe(1);
  });

  test('damage is positive when we ADD text the provider never said', () => {
    const c = scoreEvalCase({ ...base, display: 'The patient denies chest pain today' });
    expect(c.damage).toBeGreaterThan(0);
  });

  test('damage is negative when we fix something (reported, not an error)', () => {
    const c = scoreEvalCase({
      ...base,
      hypothesis: 'The patient denies chest pains.',
      display: base.hypothesis,
    });
    expect(c.damage).toBeLessThan(0);
  });

  test('no display = not scored, damage 0 (a text-only probe)', () => {
    expect(scoreEvalCase(base).scoredDisplay).toBe(false);
    expect(scoreEvalCase(base).damage).toBe(0);
  });
});

describe('summarizeEval + renderEvalReport', () => {
  test('slices by domain and mines confusions', () => {
    const a = scoreEvalCase({
      id: 'a',
      kind: 'medical',
      reference: 'give albuterol now',
      hypothesis: 'give all but a roll now',
      display: 'give all but a roll now',
      terms: ['albuterol'],
    });
    const b = scoreEvalCase({
      id: 'b',
      kind: 'legal',
      reference: 'mark exhibit twelve',
      hypothesis: 'mark exit bit twelve',
      display: 'mark exit bit twelve',
      terms: ['exhibit'],
    });
    const s = summarizeEval([a, b]);
    expect(s.total).toBe(2);
    expect(Object.keys(s.byKind).sort()).toEqual(['legal', 'medical']);
    expect(s.overall.damage).toBe(0);
    expect(s.confusions[0].pair).toBeTruthy();
    expect(s.missedTerms.sort()).toEqual(['albuterol', 'exhibit']);
  });

  test('report renders every slice and drops nothing silently', () => {
    const a = scoreEvalCase({
      id: 'a',
      kind: 'medical',
      reference: 'denies chest pain',
      hypothesis: 'chest pain',
      display: 'chest pain',
      criticalPhrases: ['denies'],
    });
    const md = renderEvalReport(summarizeEval([a]), { title: 'STT eval' });
    expect(md).toContain('| slice |');
    expect(md).toContain('medical');
    expect(md).toContain('DROPPED critical phrases');
    expect(md).toContain('denies');
  });
});

describe('tokenizer parity', () => {
  test('tokenize is normalize + split (no surprises between the two)', () => {
    const text = 'Um, take 25 mg — twice daily.';
    expect(tokenizeForScoring(text)).toEqual(normalizeForScoring(text).split(' ').filter(Boolean));
  });
});
