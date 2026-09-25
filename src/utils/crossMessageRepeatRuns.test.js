/**
 * v4.152.0 — cross-message repeat dimming (display-only).
 * Rule: a ≥4-word run in the CURRENT bubble that already appeared in the
 * PREVIOUS bubble is dimmed (.repeat-dim), never removed.
 */
import { findCrossMessageRepeatRuns } from './crossMessageRepeatRuns';
import { REPEAT_DIM_MIN_OPACITY } from './repeatedWordRuns';

const read = (text, r) => text.slice(r.start, r.end);

describe('findCrossMessageRepeatRuns', () => {
  test('tail of previous message repeated as head of next', () => {
    const prev = "I'm sending it to the clinic for the doctor to sign off on. If there's any issues, the doctor's office will contact her. The";
    const text = "If there's any issues, the doctor's office will contact her. But if not, then she can wait for the pharmacy to";
    const ranges = findCrossMessageRepeatRuns(prev, text);
    expect(ranges.length).toBeGreaterThan(0);
    expect(read(text, ranges[0])).toMatch(/If there/i);
    // Whole run matches the repeated sentence (normalize keeps trailing period).
    expect(read(text, ranges[0]).toLowerCase()).toBe(
      "if there's any issues, the doctor's office will contact her.",
    );
  });

  test('whole-message repeat dims the entire later copy', () => {
    const prev = 'she can wait for the pharmacy to contact her when it is ready';
    const text = 'She can wait for the pharmacy to contact her when it\'s ready';
    const ranges = findCrossMessageRepeatRuns(prev, text);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ start: 0, words: 10 }); // "it's" ≠ "is" stops the run
    expect(read(text, ranges[0])).toBe('She can wait for the pharmacy to contact her when');
  });

  test('short overlap (<4 words) is untouched', () => {
    const ranges = findCrossMessageRepeatRuns('please call me now', 'please call me later');
    expect(ranges).toEqual([]); // common run "please call me" = 3 words < 4
  });

  test('unrelated text yields no ranges', () => {
    const ranges = findCrossMessageRepeatRuns('the weather is nice today', 'please bring two forms of identification');
    expect(ranges).toEqual([]);
  });

  test('case insensitive, ranges map onto original chars', () => {
    const prev = 'The DOCTOR will contact her today.';
    const text = 'the doctor will contact her later this week';
    const ranges = findCrossMessageRepeatRuns(prev, text);
    expect(ranges).toHaveLength(1);
    expect(read(text, ranges[0])).toBe('the doctor will contact her'); // "her" ≠ "her."
  });

  test('empty or oversized input is a no-op (never dims something wrong)', () => {
    expect(findCrossMessageRepeatRuns('', 'some text here today')).toEqual([]);
    expect(findCrossMessageRepeatRuns('some text here today', '')).toEqual([]);
  });

  test('repeat-dim floor stays ≥70% visible', () => {
    expect(REPEAT_DIM_MIN_OPACITY).toBeGreaterThanOrEqual(0.7);
  });
});
