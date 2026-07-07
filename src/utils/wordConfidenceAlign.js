/** Map Deepgram word confidence onto display tokens. v4.80.2 */

const normalizeWord = (word) =>
  (word || '').toString().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Align Deepgram word metadata to display words (after formatting).
 * Returns one entry per display word: { word, confidence }.
 */
export const alignWordConfidence = (displayText, wordConfidence = []) => {
  if (!displayText?.trim() || !wordConfidence?.length) return [];

  const displayWords = displayText.trim().split(/\s+/).filter(Boolean);
  const aligned = [];
  let dgIdx = 0;

  for (let i = 0; i < displayWords.length; i += 1) {
    const norm = normalizeWord(displayWords[i]);
    let confidence = null;

    if (dgIdx < wordConfidence.length && wordConfidence[dgIdx].word === norm) {
      confidence = wordConfidence[dgIdx].confidence;
      dgIdx += 1;
    } else {
      const lookAhead = wordConfidence.slice(dgIdx, dgIdx + 4).findIndex((w) => w.word === norm);
      if (lookAhead >= 0) {
        dgIdx += lookAhead;
        confidence = wordConfidence[dgIdx].confidence;
        dgIdx += 1;
      } else if (i < wordConfidence.length) {
        confidence = wordConfidence[i]?.confidence ?? null;
        if (dgIdx < wordConfidence.length) dgIdx += 1;
      }
    }

    aligned.push({ word: displayWords[i], confidence });
  }

  return aligned;
};

/** Visual tier for a confidence score — color-first, not opacity-only. */
export const confidenceVisualFor = (confidence, isFinal = true) => {
  if (!Number.isFinite(confidence)) {
    return { color: '#ffffff', className: '', opacity: 1 };
  }
  if (confidence >= 0.85) {
    return { color: '#ffffff', className: '', opacity: 1 };
  }
  if (confidence >= 0.65) {
    return { color: '#cbd5e1', className: 'confidence-word--mid', opacity: 1 };
  }
  const tentative = !isFinal ? ' confidence-word--tentative' : '';
  return {
    color: '#fbbf24',
    className: `confidence-word--low${tentative}`,
    opacity: 0.92,
  };
};

export const splitTextWithSpaces = (text) => text.split(/(\s+)/);
