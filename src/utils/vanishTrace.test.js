/**
 * Vanish / derender trace (v4.84.2).
 * Console: filter `[CAT VANISH]` · buffer: `window.__catintVanishTrace`
 * Mute: `window.__catintVanishOn = false`
 */

import { flagVanish, lostWords, textShortened } from './vanishTrace';

describe('vanishTrace', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.__catintVanishTrace = [];
      window.__catintVanishOn = true;
    }
  });

  test('lostWords finds dropped tokens', () => {
    expect(lostWords('one two three', 'one three')).toEqual(['two']);
  });

  test('textShortened detects shrink', () => {
    expect(textShortened('a b c', 'a b')).toBe(true);
    expect(textShortened('a b', 'a b c')).toBe(false);
  });

  test('flagVanish pushes when shortened', () => {
    const entry = flagVanish('test_reason', { before: 'hello world', after: 'hello' });
    expect(entry).toBeTruthy();
    expect(entry.flag).toBe('VANISH');
    expect(entry.lost).toContain('world');
    expect(window.__catintVanishTrace.length).toBeGreaterThan(0);
  });

  test('flagVanish skips benign equal text without force', () => {
    const entry = flagVanish('noop', { before: 'same', after: 'same' });
    expect(entry).toBeNull();
  });
});
