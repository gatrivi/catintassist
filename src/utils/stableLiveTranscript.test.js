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

  test('buildCaptionContinuityKeys: live bubble seals IN PLACE (same key)', () => {
    const beforeSeal = buildCaptionContinuityKeys([
      { id: 'dg-en-1-i', turnId: 'turn-1', isFinal: false, text: 'Hello world' },
    ]);
    const afterSeal = buildCaptionContinuityKeys([
      { id: 'dg-en-1-i', turnId: 'turn-1', isFinal: true, text: 'Hello world.' },
    ]);
    // Same React key live → sealed: no remount, no vanish/reappear mid-read.
    expect(afterSeal[0]).toBe(beforeSeal[0]);
  });

  test('buildCaptionContinuityKeys: seal-split keeps first chunk on the old node, only tail mounts new', () => {
    const beforeSplit = buildCaptionContinuityKeys([
      { id: 'dg-es-152.82-i', turnId: 'turn-9', isFinal: false, text: 'Frase uno. Frase dos. Okay' },
    ]);
    const afterSplit = buildCaptionContinuityKeys([
      { id: 'dg-es-152.82-f-s0-1', turnId: 'turn-9', isFinal: true, text: 'Frase uno.' },
      { id: 'dg-es-152.82-f-s1-2', turnId: 'turn-9', isFinal: true, text: 'Frase dos.' },
      { id: 'dg-es-152.82-i', turnId: 'turn-9', isFinal: false, text: 'Okay' },
    ]);
    expect(afterSplit[0]).toBe(beforeSplit[0]); // first sealed chunk reuses the read node
    expect(new Set(afterSplit).size).toBe(3); // no duplicate keys
  });

  test('buildCaptionContinuityKeys: next live row after seal gets the next ordinal', () => {
    const keys = buildCaptionContinuityKeys([
      { id: 'a', turnId: 'turn-1', isFinal: true, text: 'Hello.' },
      { id: 'b', turnId: 'turn-1', isFinal: false, text: 'more' },
      { id: 'c', turnId: 'turn-2', isFinal: false, text: 'other turn' },
    ]);
    expect(keys[0]).not.toBe(keys[1]);
    expect(new Set(keys).size).toBe(3);
  });
});
