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
});
