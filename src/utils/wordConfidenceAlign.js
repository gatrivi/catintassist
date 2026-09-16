/** Map Deepgram word confidence onto display tokens. v4.80.2, reworked v4.121.0. */
import { dgWordToDigits } from './sensitiveDataProtector';

const normalizeWord = (word) =>
  (word || '').toString().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Min of finite confidences, else null (never invent a score). */
const minFinite = (confs) => {
  const finite = confs.filter((c) => Number.isFinite(c));
  return finite.length ? Math.min(...finite) : null;
};

/**
 * Align Deepgram word metadata to display words (after formatting).
 * Returns one entry per display word: { word, confidence }.
 *
 * v4.121.0 rules ("never paint the wrong word yellow"):
 * 1. Exact normalized match → that score (unchanged).
 * 2. Digit-heavy display token ("555-123-4567", "1:30") consumes DG
 *    digit/number words until joined digits equal → MIN confidence
 *    (weakest digit colors the run — honest).
 * 3. Otherwise → null (white). The old positional fallback grabbed
 *    whatever score sat at that index, so every stitch/grouping/expansion
 *    painted innocent words yellow. Guessing is over.
 */
export const alignWordConfidence = (displayText, wordConfidence = [], lang = 'en') => {
  if (!displayText?.trim() || !wordConfidence?.length) return [];

  const displayWords = displayText.trim().split(/\s+/).filter(Boolean);
  const aligned = [];
  let dgIdx = 0;

  for (let i = 0; i < displayWords.length; i += 1) {
    const disp = displayWords[i];
    const norm = normalizeWord(disp);
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
      } else {
        const dispDigits = (disp.match(/\d/g) || []).join('');
        if (dispDigits) {
          let acc = '';
          const confs = [];
          let j = dgIdx;
          while (
            j < wordConfidence.length &&
            confs.length < 12 &&
            acc.length < dispDigits.length + 4
          ) {
            const d = dgWordToDigits(wordConfidence[j].word, lang);
            if (d == null) break;
            acc += d;
            confs.push(wordConfidence[j].confidence);
            j += 1;
            if (acc === dispDigits) break;
          }
          if (acc === dispDigits && confs.length) {
            confidence = minFinite(confs);
            dgIdx = j;
          }
        }
        // else: null — white, never a guessed score.
      }
    }

    aligned.push({ word: disp, confidence });
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
