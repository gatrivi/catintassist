/**
 * Cross-message repeat detection (v4.152.0) — DISPLAY-ONLY graying.
 *
 * Deepgram re-delivers sentences across bubble boundaries: the tail of one
 * message comes back as the head of the next (or a whole sentence repeats).
 * The operator's rule: same word sequence seen twice → gray the LATER copy so
 * it is not read twice. Never removes text.
 *
 * Reuses the normalize/tokenize contract of `repeatedWordRuns.js`
 * (case/punctuation-insensitive, ≥4 words, split at word boundaries).
 * Returns char ranges into `text` for the later copy; caller wraps them in
 * `.repeat-dim` (see RepeatDimText).
 *
 * No React, no DOM.
 */

import { MIN_REPEAT_WORDS, MAX_SCAN_CHARS, tokenizeWithOffsets } from './repeatedWordRuns';

/**
 * Character ranges of word runs in `text` (≥4 words) that already appeared
 * verbatim in `prevText` — the previous bubble's text.
 *
 * @param {string} prevText earlier message's text (raw is fine; compare is normalized)
 * @param {string} text current message's text
 * @param {object} [opts]
 * @param {number} [opts.minWords] minimum run length (default 4)
 * @returns {Array<{start:number,end:number,words:number}>} sorted, non-overlapping
 */
export function findCrossMessageRepeatRuns(prevText, text, opts = {}) {
  const minWords = Number.isFinite(opts.minWords) ? Math.max(1, Math.floor(opts.minWords)) : MIN_REPEAT_WORDS;
  const cur = String(text || '');
  const prev = String(prevText || '');
  if (!cur.trim() || !prev.trim()) return [];
  if (cur.length > MAX_SCAN_CHARS || prev.length > MAX_SCAN_CHARS) return [];

  const curTokens = tokenizeWithOffsets(cur);
  const prevKeys = tokenizeWithOffsets(prev).map((t) => t.key);
  if (curTokens.length < minWords || prevKeys.length < minWords) return [];

  const ranges = [];
  let i = 0;
  // Greedy left-to-right: at each position take the LONGEST run that matches a
  // consecutive sequence in prev, then continue after it. O(n·m) string compares
  // on bubble-sized text — same budget class as repeatedWordRuns.
  while (i <= curTokens.length - minWords) {
    let bestLen = 0;
    for (let q = 0; q + bestLen < prevKeys.length; q += 1) {
      let l = 0;
      while (i + l < curTokens.length && q + l < prevKeys.length
        && curTokens[i + l].key === prevKeys[q + l]) l += 1;
      if (l > bestLen) bestLen = l;
    }
    if (bestLen >= minWords) {
      ranges.push({
        start: curTokens[i].start,
        end: curTokens[i + bestLen - 1].end,
        words: bestLen,
      });
      i += bestLen;
    } else {
      i += 1;
    }
  }
  return ranges;
}

export default findCrossMessageRepeatRuns;
