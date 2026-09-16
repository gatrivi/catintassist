import { alignWordConfidence, confidenceVisualFor } from './wordConfidenceAlign';

describe('wordConfidenceAlign', () => {
  test('aligns by normalized word match', () => {
    const aligned = alignWordConfidence('Hello there', [
      { word: 'hello', confidence: 0.96 },
      { word: 'there', confidence: 0.42 },
    ]);
    expect(aligned).toHaveLength(2);
    expect(aligned[0].confidence).toBe(0.96);
    expect(aligned[1].confidence).toBe(0.42);
  });

  test('look-ahead when display adds punctuation', () => {
    const aligned = alignWordConfidence('Hello, there', [
      { word: 'hello', confidence: 0.9 },
      { word: 'there', confidence: 0.5 },
    ]);
    expect(aligned[0].confidence).toBe(0.9);
    expect(aligned[1].confidence).toBe(0.5);
  });

  test('confidenceVisualFor uses yellow for low scores', () => {
    const low = confidenceVisualFor(0.4, false);
    expect(low.color).toBe('#fbbf24');
    expect(low.className).toContain('confidence-word--low');
    expect(low.className).toContain('confidence-word--tentative');
    const high = confidenceVisualFor(0.95, true);
    expect(high.color).toBe('#ffffff');
  });

  // v4.121.0: digit runs consume DG tokens, min confidence wins.
  test('stitched phone run takes weakest digit score', () => {
    const dg = [{ word: 'call', confidence: 0.95 }].concat(
      '5 5 5 1 2 3 4'.split(' ').map((w, i) => ({
        word: w,
        confidence: i === 3 ? 0.4 : 0.95,
      })),
    );
    const aligned = alignWordConfidence('call 5551234', dg);
    expect(aligned[0].confidence).toBe(0.95);
    expect(aligned[1].confidence).toBe(0.4);
  });

  test('grouped phone with dashes aligns via digit join', () => {
    const dg = '5 5 5 1 2 3 4 5 6 7'.split(' ').map((w) => ({ word: w, confidence: 0.9 }));
    const aligned = alignWordConfidence('555-123-4567', dg);
    expect(aligned).toHaveLength(1);
    expect(aligned[0].confidence).toBe(0.9);
  });

  test('spoken number-words align through the lane map', () => {
    const aligned = alignWordConfidence(
      'at 1:30',
      [
        { word: 'at', confidence: 0.9 },
        { word: 'one', confidence: 0.8 },
        { word: 'thirty', confidence: 0.5 },
      ],
      'en',
    );
    expect(aligned[0].confidence).toBe(0.9);
    expect(aligned[1].confidence).toBe(0.5);
  });

  // v4.121.0: no positional guessing — unmatched words stay white.
  test('expanded words with no DG counterpart stay null', () => {
    const aligned = alignWordConfidence('we have 1:00, 1:30', [
      { word: 'we', confidence: 0.9 },
      { word: 'have', confidence: 0.9 },
      { word: '1', confidence: 0.3 },
      { word: '1', confidence: 0.3 },
      { word: '30', confidence: 0.3 },
    ]);
    expect(aligned[0].confidence).toBe(0.9);
    expect(aligned[1].confidence).toBe(0.9);
    // "1:00," digits "100" match nothing ("1"+"1"+"30"="1130") → null, white.
    expect(aligned[2].confidence).toBeNull();
  });

  test('shifted words no longer steal neighbors scores', () => {
    // Old positional fallback painted "beta" with zzz's 0.1 (yellow).
    const aligned = alignWordConfidence('alpha beta', [
      { word: 'alpha', confidence: 0.9 },
      { word: 'zzz', confidence: 0.1 },
    ]);
    expect(aligned[0].confidence).toBe(0.9);
    expect(aligned[1].confidence).toBeNull();
  });
});
