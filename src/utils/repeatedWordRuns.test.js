/**
 * v4.142.0 — repeat detector for the readability net.
 *
 * Contract pinned here:
 *  - only LATER occurrences are returned (the first copy stays full brightness);
 *  - the returned ranges map onto the ORIGINAL characters, byte for byte, so the
 *    renderer can wrap them without touching a single character;
 *  - comparison is case/punctuation-insensitive but nothing is normalized in the
 *    returned text;
 *  - short repeats (ordinary speech) are ignored; long text is capped.
 */
import {
  MIN_REPEAT_WORDS,
  REPEAT_DIM_MIN_OPACITY,
  countWords,
  findRepeatedWordRuns,
  mergeRanges,
  normalizeWord,
  splitTextByRuns,
  tokenizeWithOffsets,
} from './repeatedWordRuns';

/** The sentence from the reported screenshot (one bubble, twice). */
const SCREENSHOT_SENTENCE =
  'You said you did a unemployment claim, but they wanted to follow-up with you. Or you want to speak with Social Security';

const dimmedText = (text, opts) =>
  splitTextByRuns(text, findRepeatedWordRuns(text, opts))
    .filter((p) => p.dim)
    .map((p) => p.text)
    .join('|');

describe('findRepeatedWordRuns — later occurrence only (v4.142.0)', () => {
  test('marks the second copy, not the first, at the right character range', () => {
    const text = 'we will call you back we will call you back';
    const runs = findRepeatedWordRuns(text);
    expect(runs).toHaveLength(1);
    // "we will call you back" = 21 chars, then a space → second copy starts at 22.
    expect(text.slice(runs[0].start, runs[0].end)).toBe('we will call you back');
    expect(runs[0].start).toBe(22);
    expect(runs[0].end).toBe(text.length);
    expect(runs[0].words).toBe(5);
    // The earlier occurrence is reported as the source, and is NOT in the ranges.
    expect(text.slice(runs[0].sourceStart, runs[0].sourceEnd)).toBe('we will call you back');
    expect(runs.some((r) => r.start === 0)).toBe(false);
  });

  test('the screenshot sentence: exactly one copy is dimmed, the other is untouched', () => {
    const text = `${SCREENSHOT_SENTENCE}. ${SCREENSHOT_SENTENCE}.`;
    const parts = splitTextByRuns(text, findRepeatedWordRuns(text));
    const dim = parts.filter((p) => p.dim);
    expect(dim).toHaveLength(1);
    expect(dim[0].text.trim()).toBe(`${SCREENSHOT_SENTENCE}.`);
    // Nothing was lost: the concatenation is byte-identical to the input.
    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.map((p) => p.text).join('').match(/unemployment claim/g)).toHaveLength(2);
  });

  test('case and punctuation differences still count as the same wording', () => {
    const text = 'Please confirm the spelling of your last name, please confirm the spelling of your last name';
    const runs = findRepeatedWordRuns(text);
    expect(runs).toHaveLength(1);
    expect(text.slice(runs[0].start, runs[0].end)).toBe(
      'please confirm the spelling of your last name',
    );
    // Normalized words only differ by case/commas ("name," ≡ "name").
    expect(normalizeWord('names,')).toBe('names');
    expect(normalizeWord('1st')).toBe('1st');
    expect(normalizeWord('"Follow-up,"')).toBe('follow-up');
  });

  test('respects the minimum run length (default 4)', () => {
    expect(MIN_REPEAT_WORDS).toBe(4);
    const threeWords = 'no not now no not now';
    expect(findRepeatedWordRuns(threeWords)).toEqual([]);
    const runs = findRepeatedWordRuns(threeWords, { minWords: 3 });
    expect(runs).toHaveLength(1);
    expect(threeWords.slice(runs[0].start, runs[0].end)).toBe('no not now');

    // Ordinary speech repeats stay untouched at the default bar.
    expect(findRepeatedWordRuns('no no you you thank you thank you')).toEqual([]);
  });

  test('no false positive when a phrase appears only once', () => {
    expect(findRepeatedWordRuns('the patient is allergic to penicillin')).toEqual([]);
    expect(findRepeatedWordRuns('You want to speak with Social Security')).toEqual([]);
  });

  test('ranges never overlap and stay sorted, even in a self-similar text', () => {
    const text = 'the patient takes 5 mg the patient takes 5 mg the patient takes 5 mg daily';
    const runs = findRepeatedWordRuns(text);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    runs.forEach((r, i) => {
      expect(r.end).toBeGreaterThan(r.start);
      if (i > 0) expect(r.start).toBeGreaterThanOrEqual(runs[i - 1].end);
    });
    // Numbers are dimmed like any other word, but they are still on screen twice.
    expect(dimmedText(text)).toContain('5 mg');
    const parts = splitTextByRuns(text, runs);
    expect(parts.map((p) => p.text).join('')).toBe(text);
  });

  test('mergeRanges unions overlapping input', () => {
    const merged = mergeRanges([
      { start: 10, end: 20, words: 4, sourceStart: 0, sourceEnd: 10 },
      { start: 14, end: 26, words: 5, sourceStart: 2, sourceEnd: 12 },
      { start: 40, end: 48, words: 4, sourceStart: 3, sourceEnd: 9 },
    ]);
    expect(merged).toEqual([
      expect.objectContaining({ start: 10, end: 26 }),
      expect.objectContaining({ start: 40, end: 48 }),
    ]);
  });

  test('long text is capped and never scanned beyond the window', () => {
    const head = 'alpha bravo charlie delta alpha bravo charlie delta ';
    // Distinct filler words: the only repeat in the whole text is the head one.
    const filler = `${Array.from({ length: 1200 }, (_, i) => `w${i}`).join(' ')} `;
    const text = `${head}${filler}alpha bravo charlie delta`;
    expect(text.length).toBeGreaterThan(6000);

    const small = findRepeatedWordRuns(text, { maxChars: 200 });
    expect(small).toHaveLength(1);
    expect(small[0].end).toBeLessThanOrEqual(200);

    // ... and the tail repeat past the window is never reached (capped work).
    expect(findRepeatedWordRuns(text).some((r) => r.start > 6000)).toBe(false);
    // Degenerate window: no token fits → nothing to scan, nothing marked.
    expect(findRepeatedWordRuns(text, { maxChars: 1 })).toEqual([]);
  });

  test('empty and one-word input returns no ranges', () => {
    expect(findRepeatedWordRuns('')).toEqual([]);
    expect(findRepeatedWordRuns(null)).toEqual([]);
    expect(findRepeatedWordRuns(undefined)).toEqual([]);
    expect(findRepeatedWordRuns('   ')).toEqual([]);
    expect(findRepeatedWordRuns('hello')).toEqual([]);
    expect(findRepeatedWordRuns('hello hello')).toEqual([]);
  });

  test('is deterministic (same input, same ranges)', () => {
    const text = `${SCREENSHOT_SENTENCE}. ${SCREENSHOT_SENTENCE}.`;
    expect(findRepeatedWordRuns(text)).toEqual(findRepeatedWordRuns(text));
  });
});

describe('splitTextByRuns — display-only chunking (v4.142.0)', () => {
  test('chunks concatenate back to the exact input', () => {
    const text = 'take 5 mg daily take 5 mg daily';
    const parts = splitTextByRuns(text, findRepeatedWordRuns(text));
    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.dim)).toHaveLength(1);
  });

  test('no ranges → one undimmed chunk', () => {
    expect(splitTextByRuns('hello there', [])).toEqual([
      { text: 'hello there', dim: false, wordOffset: 0 },
    ]);
    expect(splitTextByRuns('', [])).toEqual([]);
  });

  test('wordOffset tracks words before each chunk (confidence alignment)', () => {
    const text = 'we will call you back we will call you back';
    const parts = splitTextByRuns(text, findRepeatedWordRuns(text));
    expect(parts.map((p) => p.wordOffset)).toEqual([0, 5]);
    expect(countWords(text)).toBe(10);
    expect(parts.reduce((sum, p) => sum + countWords(p.text), 0)).toBe(10);
  });

  test('tokenizeWithOffsets returns original character offsets', () => {
    const tokens = tokenizeWithOffsets('call 555-123-4567 now');
    expect(tokens.map((t) => t.raw)).toEqual(['call', '555-123-4567', 'now']);
    expect('call 555-123-4567 now'.slice(tokens[1].start, tokens[1].end)).toBe('555-123-4567');
  });
});

describe('visibility floor contract (v4.142.0)', () => {
  test('the shipped floor is at least 70%', () => {
    expect(REPEAT_DIM_MIN_OPACITY).toBeGreaterThanOrEqual(0.7);
  });
});
