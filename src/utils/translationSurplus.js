/**
 * Surplus detector: "this translation is longer than its source can be"
 * (v4.169.0).
 *
 * WHY. On a real CSA call an English bubble reading
 *   `I went to face my husband and my`
 * (11 words, no terminal punctuation) was displaying
 *   `Yo fui a enfrentar a mi esposo y a mi familia, y les dije que no estaba
 *    bien lo que estábamos haciendo. Tanto como` (~24 words).
 *
 * The Spanish contained two clauses the source never said. For an interpreter
 * that is not a cosmetic bug, it is being handed content that was never
 * spoken. `isTruncatedTranslation` cannot catch it: that detector handles the
 * DROP case, and its Signal B requires terminal punctuation on the source —
 * which an unterminated live caption, the exact shape that overruns, never has.
 *
 * WHAT THIS IS NOT. This is a warning, not a repair. It does not guess which
 * part is wrong and it does not touch the text. The defects that produce the
 * surplus are fixed separately; this exists so that, if one slips through, the
 * operator SEES it instead of reading it with confidence. Same philosophy as
 * the negation guard (v4.156.0): report, never invent.
 *
 * The threshold is deliberately generous. A false positive costs a glance; a
 * false negative costs the interpreter trusting a sentence that was never said.
 */

const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Below this there is not enough signal to say anything. */
export const SURPLUS_MIN_WORDS = 5;

/**
 * EN->ES legitimately grows; ES->EN legitimately shrinks. So the ceiling is
 * direction-aware, and set well above real growth so normal Spanish expansion
 * (often 1.3-1.5x) never trips it.
 */
export const SURPLUS_RATIO_EN_ES = 1.9;
export const SURPLUS_RATIO_ES_EN = 2.2;

const ceilingFor = (sourceLang) => (
  String(sourceLang || '').toLowerCase().startsWith('es')
    ? SURPLUS_RATIO_ES_EN
    : SURPLUS_RATIO_EN_ES
);

const countWords = (s) => s.split(/\s+/).filter(Boolean).length;

/** Proper nouns and doses survive translation 1:1 and inflate the ratio honestly. */
const looksNumeric = (s) => /\d/.test(s);

/**
 * @returns {{suspect:boolean, reason:string|null, ratio:number, srcWords:number, outWords:number, ceiling:number}}
 */
export const translationSurplus = (source, translation, sourceLang = 'en') => {
  const src = normalize(source);
  const out = normalize(translation);
  const ceiling = ceilingFor(sourceLang);

  if (!src || !out) return { suspect: false, reason: null, ratio: 0, srcWords: 0, outWords: 0, ceiling };
  // A translation identical to the source is a passthrough, not a surplus.
  if (out === src) return { suspect: false, reason: null, ratio: 1, srcWords: 0, outWords: 0, ceiling };

  const srcWords = countWords(src);
  const outWords = countWords(out);
  const base = { suspect: false, reason: null, ratio: 0, srcWords, outWords, ceiling };

  if (srcWords < SURPLUS_MIN_WORDS) return base;
  if (outWords <= srcWords) return base;

  const ratio = outWords / srcWords;
  if (ratio <= ceiling) return { ...base, ratio };

  // Second, independent signal: the surplus has to be structural, not numeric.
  // A long source full of doses legitimately produces a long translation, so we
  // discount it. Genuine overrun adds whole CLAUSES.
  if (looksNumeric(src) && !looksNumeric(out)) return { ...base, ratio };

  // Count sentence-ish boundaries: real surplus is punctuated like sentences
  // that the source does not contain.
  const srcStops = (src.match(/[.!?;]/g) || []).length;
  const outStops = (out.match(/[.!?;]/g) || []).length;
  const clauseSurplus = outStops > srcStops;

  // Either the ratio is extreme, or it is over the ceiling AND the translation
  // added clause boundaries the source never had.
  if (ratio >= ceiling + 0.7 || clauseSurplus) {
    return {
      suspect: true,
      reason: clauseSurplus ? 'clauses' : 'length',
      ratio: Math.round(ratio * 100) / 100,
      srcWords,
      outWords,
      ceiling,
    };
  }
  return { ...base, ratio: Math.round(ratio * 100) / 100 };
};

/** Boolean convenience, for call sites that only need a yes/no. */
export const isTranslationSurplus = (source, translation, sourceLang = 'en') =>
  translationSurplus(source, translation, sourceLang).suspect;

/** One line for the bubble rail. */
export const describeSurplus = (info) => {
  if (!info?.suspect) return '';
  const times = `${info.ratio}×`;
  return info.reason === 'clauses'
    ? `⚠ translation has ${times} the source's words and extra clauses — may not match this line`
    : `⚠ translation is ${times} the source's length — may not match this line`;
};
