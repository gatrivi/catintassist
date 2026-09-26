/**
 * Vanish / derender trace (v4.84.2).
 * Console: filter `[CAT VANISH]` · buffer: `window.__catintVanishTrace`
 * Mute: `window.__catintVanishOn = false`
 */

import { flagVanish, lostWords, textShortened, observeDomVanish } from './vanishTrace';

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

  test('v4.155.1: re-punctuation is not a vanish (the fake 82/96 alarm)', () => {
    // This is the exact pair the eval replay produced: Deepgram's interim text
    // vs its own final text. Nothing vanished — it gained words and commas.
    const interim = 'blood pressure 128 over 82 heart rate 96';
    const final = 'Blood pressure 128 over 82, heart rate 96, oxygen saturation 94 percent.';
    expect(lostWords(interim, final)).toEqual([]);
  });

  test('v4.155.1: a real digit loss is still reported', () => {
    expect(lostWords('my number is 555 123 4567 ok', 'my number is ok')).toContain('555');
    expect(lostWords('dosis 500 mg', 'dosis mg')).toContain('500');
  });

  test('v4.155.1: phone formatting (555-123-4567 -> 5551234567) is not a vanish', () => {
    expect(lostWords('call 555-123-4567', 'call 5551234567')).toEqual([]);
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

  const flushMutations = () => new Promise((r) => setTimeout(r, 0));

  test('observeDomVanish flags removed and relocated bubbles', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const stop = observeDomVanish(container);

    const bubble = document.createElement('div');
    bubble.className = 'transcript-bubble';
    bubble.textContent = 'my phone is 555-123-4567';
    container.appendChild(bubble);
    await flushMutations();
    window.__catintVanishTrace = [];

    container.removeChild(bubble);
    await flushMutations();
    expect(window.__catintVanishTrace.some((e) => e.reason === 'dom_bubble_removed')).toBe(true);

    const reborn = document.createElement('div');
    reborn.className = 'transcript-bubble';
    reborn.textContent = 'my phone is 555-123-4567';
    container.appendChild(reborn);
    await flushMutations();
    expect(window.__catintVanishTrace.some((e) => e.reason === 'dom_bubble_relocated')).toBe(true);

    stop();
    document.body.removeChild(container);
  });
});
