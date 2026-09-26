/** Translation quality helpers — v4.50.0 / v4.94.0 tiny sentence chunks */

import { peelCompleteSentences } from './transcriptFormat';
import {
  isGarbageTranslation,
  isSuspiciouslyShort,
  segmentLongMonologue,
  DEFAULT_MAX_SEGMENT_WORDS,
} from './translationApplicator';

export {
  isGarbageTranslation,
  isSuspiciouslyShort,
  segmentLongMonologue,
  DEFAULT_MAX_SEGMENT_WORDS,
};

const normalize = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Token overlap ratio (0–1). High = likely passthrough / failed translation. */
export const translationSimilarity = (source, translation) => {
  const a = normalize(source);
  const b = normalize(translation);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aTokens = a.split(/\s+/).filter(Boolean);
  const bTokens = b.split(/\s+/).filter(Boolean);
  if (!aTokens.length || !bTokens.length) return 0;

  const bSet = new Set(bTokens);
  let shared = 0;
  for (const t of aTokens) {
    if (bSet.has(t)) shared += 1;
  }
  return shared / Math.max(aTokens.length, bTokens.length);
};

/**
 * Reject translations that are effectively still the source language.
 * IVR/legal calls often get English echoed back from free APIs.
 */
export const isTranslationPassthrough = (source, translation, sourceLang, targetLang) => {
  const src = normalize(source);
  const out = normalize(translation);
  if (!src || !out) return true;

  const sLang = (sourceLang || 'en').toLowerCase().slice(0, 2);
  const tLang = (targetLang || 'es').toLowerCase().slice(0, 2);
  if (sLang === tLang) return false;

  if (src === out) return true;

  const similarity = translationSimilarity(source, translation);
  // EN→ES: >72% shared tokens means the engine probably echoed English.
  if (sLang === 'en' && tLang === 'es' && similarity >= 0.72) return true;

  // ES→EN: slightly looser — Spanish fragments in mixed output are rarer.
  if (sLang === 'es' && tLang === 'en' && similarity >= 0.78) return true;

  return false;
};

/**
 * Words that can only be followed by a noun phrase: a source ending in one of
 * these is dangling a modifier ("…waiting for him.", "…entered into the record.")
 * and the translation MUST carry that whole phrase. Used only as a signal, never
 * on its own — too many legitimate sentences end this way.
 */
const DANGLING_TAIL_WORDS = new Set([
  'for', 'about', 'into', 'with', 'to', 'of', 'on', 'in', 'at', 'from', 'by',
  'after', 'during', 'against', 'between', 'without', 'within', 'onto', 'upon',
]);

const TERMINAL_PUNCT = /[.!?…]["')\]]?\s*$/;
const DANGLING_TAIL = /(?:waiting|looking|listening|saying|entering|going|sending|giving|asking|signed|recorded|spoken|written)\s+\w{0,14}$/i;

/** Source length below this: too short to judge, never flagged. */
const MIN_SOURCE_WORDS = 6;

/**
 * v4.161.0 — did the translation quietly DROP the end of the sentence?
 *
 * Found with a real CSA call (2026-09-26). Source:
 *   "…so that after all of this is done, he already has those resources there
 *    waiting for him."
 * Translation:
 *   "…de modo que después de todo de esto se hace, Él ya tiene esos recursos allí"
 * "waiting for him" is simply gone — and every existing guard passed it, because
 * Spanish came back LONGER than English (31 words vs 26) and `isSuspiciouslyShort`
 * only fires under 25%. A fluent, confident, incomplete translation is more
 * dangerous than a blank one: the interpreter trusts it.
 *
 * Two signals, both required, so this cannot fire on its own:
 *   A. the source dangles a modifier ("…waiting for him"), and
 *   B. the translation does not end in terminal punctuation.
 * Plus an independent, deliberately generous length floor as a second net.
 *
 * This is a DETECTOR, not a fixer. No heuristic can prove meaning is complete;
 * when this fires, a human decides.
 */
export const isTruncatedTranslation = (source, translation) => {
  const src = normalize(source);
  const out = normalize(translation);
  if (!src || !out) return false;
  const srcWords = src.split(/\s+/).filter(Boolean);
  if (srcWords.length < MIN_SOURCE_WORDS) return false;

  // Independent net: only a gross loss trips this, never normal compression.
  // (EN→ES normally grows; ES→EN can shrink ~20% legitimately.)
  const outWords = out.split(/\s+/).filter(Boolean).length;
  if (outWords < Math.max(3, Math.floor(srcWords.length * 0.45))) return true;

  // Signal A: the source is left hanging on a modifier that must be translated.
  const tail = srcWords.slice(-3);
  const dangles = tail.some((w) => DANGLING_TAIL_WORDS.has(w)) || DANGLING_TAIL.test(src);
  if (!dangles) return false;

  // Signal B: …and the translation simply stops, where the source finished.
  return TERMINAL_PUNCT.test(src) && !TERMINAL_PUNCT.test(out);
};

/** True when translation looks broken and should retry — weak accepts are settled (v4.55.0). */
export const isTranslationStuckForRetranslate = (
  source,
  translation,
  sourceLang,
  targetLang,
  { quality } = {},
) => {
  if (quality === 'weak') return false;
  if (!translation?.trim()) return false;
  const normSource = normalize(source);
  const normTranslation = normalize(translation);
  if (!normSource.length) return false;
  return (
    normTranslation === normSource ||
    isTranslationPassthrough(source, translation, sourceLang, targetLang) ||
    isTruncatedTranslation(source, translation)
  );
};

/** Split on sentence boundaries (matches Deepgram bubble splits). */
export const splitTranslatableSegments = (text) => {
  const normText = (text || '').trim().replace(/\s+/g, ' ');
  if (!normText) return [];

  const { sentences, remainder } = peelCompleteSentences(normText);
  if (sentences.length === 0) return [normText];

  const segments = [...sentences];
  if (remainder.length > 1) segments.push(remainder);
  return segments;
};

/**
 * Sentence peel + tiny chunks for API requests (v4.94.0).
 * One sentence or one comma-clause at a time — never a paragraph: the local
 * model returns tiny chunks in seconds but paragraphs stall for minutes.
 */
export const splitLongForTranslation = (text, { maxWords = DEFAULT_MAX_SEGMENT_WORDS } = {}) =>
  segmentLongMonologue(text, { maxWords });

/** True when text ends with sentence punctuation (stable for translation). */
export const isSentenceComplete = (text) => /[.!?…]\s*$/.test((text || '').trim());

/** True when incremental interim text is growing; false on bubble split / rewrite. */
export const isIncrementalTranscriptGrowth = (prevText, nextText) => {
  const prev = normalize(prevText);
  const next = normalize(nextText);
  if (!prev || !next) return false;
  if (prev === next) return true;
  // Interim caption still growing forward
  if (next.startsWith(prev)) return true;
  // Tiny tail trim (punctuation finalize) on same prefix
  if (prev.startsWith(next) && prev.length - next.length <= 3) return true;
  return false;
};
