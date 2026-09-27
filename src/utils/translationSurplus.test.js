import {
  translationSurplus, isTranslationSurplus, describeSurplus,
  SURPLUS_RATIO_EN_ES, SURPLUS_RATIO_ES_EN, SURPLUS_MIN_WORDS,
} from './translationSurplus';

// v4.169.0. The surplus detector exists because of one real bubble:
//
//   source      `I went to face my husband and my`            (11 words)
//   displayed   `Yo fui a enfrentar a mi esposo y a mi familia, y les dije que
//                no estaba bien lo que estábamos haciendo. Tanto como` (~24)
//
// The Spanish carried two clauses nobody said. The DETECTOR must be allowed to
// miss (too strict) far more often than it fires on honest Spanish, because a
// false positive costs a glance and a false negative costs the interpreter
// trusting a sentence that was never spoken.

const OVERRUN = [
  'I went to face my husband and my',
  'Yo fui a enfrentar a mi esposo y a mi familia, y les dije que no estaba bien lo que estábamos haciendo. Tanto como',
];

describe('translationSurplus — the real overrun', () => {
  test('catches the exact pair from the call', () => {
    const r = translationSurplus(OVERRUN[0], OVERRUN[1], 'en');
    expect(r.suspect).toBe(true);
    expect(r.reason).toBe('clauses');
    expect(r.srcWords).toBe(8); // "I went to face my husband and my"
    expect(r.outWords).toBe(24);
    expect(r.ratio).toBeGreaterThan(SURPLUS_RATIO_EN_ES);
  });

  test('fires even with NO terminal punctuation on the source', () => {
    // isTruncatedTranslation requires terminal punctuation, so an unterminated
    // live caption - the exact shape that overruns - is invisible to it. This
    // one must not be.
    expect(OVERRUN[0].endsWith('.')).toBe(false);
    expect(isTranslationSurplus(OVERRUN[0], OVERRUN[1], 'en')).toBe(true);
  });
});

describe('translationSurplus — must NOT fire on honest translation', () => {
  test('a faithful, complete translation', () => {
    const src = 'I went to face my husband and my family and I told them it was wrong.';
    const out = 'Fui a enfrentar a mi esposo y a mi familia y les dije que estaba mal.';
    expect(isTranslationSurplus(src, out, 'en')).toBe(false);
  });

  test('Spanish that legitimately grows toward English', () => {
    // ES->EN compresses; a wordier English is normal, and the ceiling for this
    // direction is the generous one.
    const src = 'Fui a enfrentar a mi esposo y a mi familia y les dije que no estaba bien lo que estábamos haciendo.';
    const out = 'I went to face my husband and my family and I told them that what we were doing was not right.';
    expect(isTranslationSurplus(src, out, 'es')).toBe(false);
  });

  test('a long source of doses and numbers — no false alarm', () => {
    const src = 'Take 5 mg of amoxicillin 250 mg twice daily for 7 days then 10 mg';
    const out = 'Tome 5 mg de amoxicilina 250 mg dos veces al dia durante 7 dias y luego 10 mg';
    expect(isTranslationSurplus(src, out, 'en')).toBe(false);
  });

  test('a passthrough is not a surplus', () => {
    const src = 'exactly the same words here friend';
    expect(isTranslationSurplus(src, src, 'en')).toBe(false);
  });

  test('nothing at all is not a surplus', () => {
    expect(isTranslationSurplus('', '', 'en')).toBe(false);
    expect(isTranslationSurplus('source text here', '', 'en')).toBe(false);
    expect(isTranslationSurplus('', 'una traduccion', 'en')).toBe(false);
  });

  test('a short source has too little signal to judge', () => {
    // Two words can double legitimately in any language. Stay quiet.
    expect(isTranslationSurplus('I know', 'Sé que lo sé muy bien', 'en')).toBe(false);
    expect(SURPLUS_MIN_WORDS).toBeGreaterThan(2);
  });

  test('a translation that is shorter or the same length is never surplus', () => {
    expect(isTranslationSurplus(
      'a much much longer english sentence than the spanish one here',
      'corto',
      'en',
    )).toBe(false);
  });
});

describe('translationSurplus — direction awareness', () => {
  test('EN->ES gets the tighter ceiling, ES->EN the generous one', () => {
    expect(SURPLUS_RATIO_EN_ES).toBeLessThan(SURPLUS_RATIO_ES_EN);
    const src = 'one two three four five six seven eight nine ten';
    // Same pair, judged from each direction.
    const asEn = translationSurplus(src, 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce', 'en');
    const asEs = translationSurplus(src, 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce', 'es');
    expect(asEn.ceiling).toBe(SURPLUS_RATIO_EN_ES);
    expect(asEs.ceiling).toBe(SURPLUS_RATIO_ES_EN);
  });
});

describe('describeSurplus', () => {
  test('says nothing when there is nothing to say', () => {
    expect(describeSurplus({ suspect: false })).toBe('');
    expect(describeSurplus(null)).toBe('');
  });

  test('names the ratio, and the clause case differently', () => {
    expect(describeSurplus({ suspect: true, reason: 'clauses', ratio: 2.2 }))
      .toMatch(/2\.2× the source's words and extra clauses/);
    expect(describeSurplus({ suspect: true, reason: 'length', ratio: 3 }))
      .toMatch(/3× the source's length/);
  });
});
