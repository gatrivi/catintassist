import {
  commonWordPrefixLen,
  promoteStablePrefix,
  advanceCommittedPrefix,
  buildCaptionContinuityKeys,
} from './stableLiveTranscript';

describe('stableLiveTranscript', () => {
  test('commonWordPrefixLen matches whole words only', () => {
    expect(commonWordPrefixLen('hello world', 'hello there')).toBe('hello '.length);
    expect(commonWordPrefixLen('a b c', 'a b d')).toBe('a b '.length);
  });

  test('promoteStablePrefix leaves last N words as tail', () => {
    const { committed, tail } = promoteStablePrefix('one two three four five', 3);
    expect(committed).toBe('one two ');
    expect(tail).toBe('three four five');
  });

  test('advanceCommittedPrefix soft-commits on first paint with enough words', () => {
    const state = advanceCommittedPrefix('', 'my number is five five five one two');
    expect(state.committed.length).toBeGreaterThan(0);
    expect(state.committed + state.tail).toBe('my number is five five five one two');
    expect(state.tail.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(3);
  });

  test('advanceCommittedPrefix grows on append', () => {
    let state = advanceCommittedPrefix('', 'one two three four five six');
    expect(state.committed + state.tail).toBe('one two three four five six');

    state = advanceCommittedPrefix(state.committed, 'one two three four five six seven eight');
    expect(state.committed.length).toBeGreaterThan(0);
    expect(state.tail.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(3);
  });

  test('advanceCommittedPrefix shrinks on early correction', () => {
    const prev = 'my number is five five ';
    const next = 'my number is 5551234567';
    const state = advanceCommittedPrefix(prev, next);
    expect(state.committedShrunk).toBe(true);
    expect(next.startsWith(state.committed)).toBe(true);
    expect(state.committed + state.tail).toBe(next);
  });

  test('buildCaptionContinuityKeys keeps live key stable per turn', () => {
    const liveOnly = buildCaptionContinuityKeys([
      { id: 'dg-en-1-i', turnId: 'turn-1', isFinal: false, text: 'hello' },
    ]);
    expect(liveOnly[0]).toBe('cont:turn-1:live');

    const afterSeal = buildCaptionContinuityKeys([
      { id: 'dg-en-1-f', turnId: 'turn-1', isFinal: true, text: 'Hello.' },
      { id: 'dg-en-2-i', turnId: 'turn-1', isFinal: false, text: 'more' },
    ]);
    expect(afterSeal[0]).toMatch(/^cont:turn-1:s0:/);
    expect(afterSeal[1]).toBe('cont:turn-1:live');
  });
});
