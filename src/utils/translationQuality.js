/** Translation quality helpers — v4.50.0 */

import { peelCompleteSentences } from './transcriptFormat';

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
