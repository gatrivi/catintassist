/**
 * Repeated word-run detection for the transcript pane (v4.142.0).
 *
 * Reported symptom: one bubble read the same phrase twice in a row ("…You said
 * you did a unemployment claim, but they wanted to follow-up with you. Or you
 * want to speak with Social Security…" printed again inside the same block) and
 * the pane became impossible to read.
 *
 * The operator's rule: **dim the repeat, never remove it** — "do a simple string
 * compare; if a sequence of words is repeated, dim it, but leave it still at
 * least 70% visible."
 *
 * This module is the pure half of that: it only *locates* the later occurrences.
 * It never edits the text — the caller renders the same characters, wrapped in a
 * `.repeat-dim` span (see `src/index.css`, floor pinned by
 * `repeatedWordRuns.test.js`). Display-only: detect → style.
 *
 * No React, no DOM.
 */

/** Shortest run worth dimming. 4 words keeps ordinary speech ("no no", "you
 *  you", "thank you thank you") untouched — those repeats are not a readability
 *  problem, they are what the speaker said. */
export const MIN_REPEAT_WORDS = 4;

/**
 * Above this many characters the scan is skipped (work cap for a pathologically
 * long bubble). Returning [] means "no dimming", never "dim something wrong".
 */
export const MAX_SCAN_CHARS = 6000;

/**
 * Minimum visibility for dimmed text. Pinned here next to the detector so the
 * floor travels with the rule; `src/index.css` holds the actual declaration and
 * `repeatedWordRuns.test.js` asserts the stylesheet never goes below it.
 */
export const REPEAT_DIM_MIN_OPACITY = 0.7;

const WORD_RE = /\S+/g;

/** Comparison key for a word: case- and punctuation-insensitive.
 *  "names," ≡ "names", "1st" ≡ "1st", "5 mg." ≡ "5 mg". */
export const normalizeWord = (raw) =>
  String(raw || '')
    .toLowerCase()
    // Keep letters (any script), digits, and the marks that live inside a word
    // (hyphen/apostrophe/decimal point) so "follow-up" and "3.5" stay words.
    .replace(/[^\p{L}\p{N}.'’-]+/gu, '');

/**
 * Tokens of `text` with their character offsets in the ORIGINAL string.
 * A token is a whitespace-delimited word; offsets are exact, so a run's range
 * maps straight back onto the rendered text.
 */
export function tokenizeWithOffsets(text = '') {
  const src = String(text || '');
  if (!src) return [];
  const tokens = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(src)) !== null) {
    tokens.push({
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
      key: normalizeWord(match[0]),
    });
  }
  return tokens;
}

/** How many whitespace-delimited words a chunk contributes (offset bookkeeping). */
export function countWords(text = '') {
  const src = String(text || '');
  if (!src.trim()) return 0;
  return (src.match(/\S+/g) || []).length;
}

/**
 * Longest run starting at each token index that already occurred EARLIER in the
 * text. `best[i].len` is that length, `best[i].at` the earlier start index.
 * O(n^2) string compares on bubble-sized text (a few dozen words).
 */
const longestEarlierRuns = (keys) => {
  const n = keys.length;
  const len = new Array(n).fill(0);
  const at = new Array(n).fill(-1);
  for (let i = 1; i < n; i += 1) {
    for (let q = 0; q < i; q += 1) {
      let l = 0;
      while (i + l < n && q + l < i && keys[q + l] === keys[i + l]) l += 1;
      if (l > len[i]) {
        len[i] = l;
        at[i] = q;
      }
    }
  }
  return { len, at };
};

/** Word-safe cut point for the scan window (never splits a token). */
const windowEnd = (text, maxChars) => {
  if (text.length <= maxChars) return text.length;
  const tokens = tokenizeWithOffsets(text);
  let end = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].end > maxChars) break;
    end = tokens[i].end;
  }
  return end;
};

/**
 * Character ranges of the LATER occurrences of a word sequence that already
 * appeared earlier in the same text.
 *
 * @param {string} text rendered text (already display-processed)
 * @param {object} [opts]
 * @param {number} [opts.minWords] minimum run length (default 4)
 * @param {number} [opts.maxChars] scan window cap (default 6000 chars)
 * @returns {Array<{start:number,end:number,words:number,sourceStart:number,sourceEnd:number}>}
 *   sorted, non-overlapping ranges into the ORIGINAL characters. `[]` when the
 *   text holds no repeat. The first occurrence is never included.
 */
export function findRepeatedWordRuns(text, opts = {}) {
  const src = String(text || '');
  const minWords = Number.isFinite(opts.minWords) ? Math.max(1, Math.floor(opts.minWords)) : MIN_REPEAT_WORDS;
  const maxChars = Number.isFinite(opts.maxChars) ? Math.max(1, Math.floor(opts.maxChars)) : MAX_SCAN_CHARS;
  if (!src.trim()) return [];

  const end = windowEnd(src, maxChars);
  if (end <= 0) return [];
  const window = src.slice(0, end);
  const tokens = tokenizeWithOffsets(window);
  if (tokens.length < minWords * 2) return [];

  const keys = tokens.map((t) => t.key);
  const { len, at } = longestEarlierRuns(keys);

  const ranges = [];
  let i = 0;
  while (i < tokens.length) {
    const l = len[i];
    if (l >= minWords) {
      const last = tokens[i + l - 1];
      ranges.push({
        start: tokens[i].start,
        end: last.end,
        words: l,
        sourceStart: tokens[at[i]].start,
        sourceEnd: tokens[at[i] + l - 1].end,
      });
      // Skip the marked run: it is on screen once, dimmed, and anything nested
      // inside it would only stack the same style.
      i += l;
    } else {
      i += 1;
    }
  }
  return ranges;
}

/** Sort + merge overlapping/adjacent ranges (keeps the first range's source). */
export function mergeRanges(ranges = []) {
  const valid = ranges
    .filter((r) => r && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.start - b.start);
  const out = [];
  valid.forEach((r) => {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
      last.words = Math.max(last.words || 0, r.words || 0);
      return;
    }
    out.push(r);
  });
  return out;
}

/**
 * Split `text` into contiguous chunks; the concatenation of `part.text` is
 * BYTE-IDENTICAL to `text`. `dim: true` marks a later repeat (style only).
 * `wordOffset` is the number of words before the chunk — callers that render
 * word-by-word (confidence tinting) need it to stay aligned after splitting.
 *
 * Splits happen at whitespace between tokens, so no token is ever cut in half.
 */
export function splitTextByRuns(text, ranges = []) {
  const src = String(text || '');
  if (!src) return [];
  const merged = mergeRanges(ranges);
  const parts = [];
  let cursor = 0;
  let wordOffset = 0;
  const push = (value, dim) => {
    if (!value) return;
    parts.push({ text: value, dim, wordOffset });
    wordOffset += countWords(value);
  };
  merged.forEach((r) => {
    const start = Math.max(cursor, Math.min(r.start, src.length));
    const end = Math.max(start, Math.min(r.end, src.length));
    push(src.slice(cursor, start), false);
    push(src.slice(start, end), true);
    cursor = end;
  });
  push(src.slice(cursor), false);
  return parts;
}
