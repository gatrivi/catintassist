import { shouldRunAutoTranslation } from './useTranslate';

describe('shouldRunAutoTranslation', () => {
  test('waits for two words before translating a final fragment', () => {
    expect(shouldRunAutoTranslation({
      isFinal: true,
      isComplete: true,
      isSplitRewrite: false,
      wordCount: 1,
      lastWordCount: 0,
    })).toBe(false);
    expect(shouldRunAutoTranslation({
      isFinal: true,
      isComplete: true,
      isSplitRewrite: false,
      wordCount: 2,
      lastWordCount: 0,
    })).toBe(true);
  });

  test('requests a live translation at ten new words', () => {
    expect(shouldRunAutoTranslation({
      isFinal: false,
      isComplete: false,
      isSplitRewrite: false,
      wordCount: 10,
      lastWordCount: 0,
    })).toBe(true);
  });

  test('does not send every live interim update', () => {
    expect(shouldRunAutoTranslation({
      isFinal: false,
      isComplete: false,
      isSplitRewrite: false,
      wordCount: 12,
      lastWordCount: 10,
    })).toBe(false);
  });
});
