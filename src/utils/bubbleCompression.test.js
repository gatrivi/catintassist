/** Unit tests — bubbleCompression policy (v4.133.0 guardrails). */
import {
  countWords,
  isCriticalBubbleText,
  bubbleExpandKey,
  shouldAutoCollapseBubble,
  LONG_BUBBLE_WORDS,
  ALWAYS_VISIBLE_TAIL_ROWS,
} from './bubbleCompression';

describe('bubbleCompression', () => {
  test('never clips live rows, however long', () => {
    expect(
      shouldAutoCollapseBubble({ wordCount: LONG_BUBBLE_WORDS + 200, isLive: true }),
    ).toBe(false);
  });

  test('never clips the rows being read (recent tail)', () => {
    expect(
      shouldAutoCollapseBubble({ wordCount: LONG_BUBBLE_WORDS + 200, isRecent: true }),
    ).toBe(false);
  });

  test('old non-critical long bubbles still collapse', () => {
    expect(
      shouldAutoCollapseBubble({ wordCount: LONG_BUBBLE_WORDS + 1 }),
    ).toBe(true);
  });

  // The policy's critical flag comes from the caller (hasCriticalDataCue /
  // containsCriticalData over the full bubble); the fast regex here is a
  // first-pass for digits + units + common cues.
  test('critical fast-path covers digits + units + common cues', () => {
    expect(isCriticalBubbleText('call 555-123-4567')).toBe(true);
    expect(isCriticalBubbleText('give five hundred milligrams twice daily')).toBe(true);
    expect(isCriticalBubbleText('give 5 mg now')).toBe(true);
    expect(isCriticalBubbleText('the patient is walking around the building today')).toBe(false);
    expect(
      shouldAutoCollapseBubble({ wordCount: LONG_BUBBLE_WORDS + 1, isCritical: true }),
    ).toBe(false);
  });

  test('expansion key is id-stable across re-seal/id churn', () => {
    const before = { id: 'dg-en-1.2-i', text: ' '.repeat(3) + 'a '.repeat(60) };
    const after = { id: 'dg-en-1.2-f~1', text: before.text };
    expect(bubbleExpandKey(before)).toBe(bubbleExpandKey(after));
  });

  test('tail constant covers the rows being read', () => {
    expect(ALWAYS_VISIBLE_TAIL_ROWS).toBeGreaterThanOrEqual(2);
    expect(countWords('one two  three')).toBe(3);
  });
});