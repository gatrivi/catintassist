import { resolveTranslateDebounceMs } from './useTranslate';

describe('resolveTranslateDebounceMs', () => {
  test('bubble split skips debounce (immediate translate)', () => {
    expect(resolveTranslateDebounceMs({ isSplitRewrite: true, forceTrigger: false, mood: 'auto' })).toBe(0);
  });

  test('normal auto mode keeps debounce', () => {
    expect(resolveTranslateDebounceMs({ isSplitRewrite: false, forceTrigger: false, mood: 'auto' })).toBe(800);
  });

  test('sentence-complete trigger in fast mood', () => {
    expect(resolveTranslateDebounceMs({ isSplitRewrite: false, forceTrigger: true, mood: 'fast' })).toBe(200);
  });
});
