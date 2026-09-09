import { TRANSLATION_FIXTURES } from '../fixtures/translation';
import {
  assertTranslationExpect,
  replayTranslationFixture,
} from './translationFixtureReplay';
import { splitLongForTranslation } from './translationQuality';

describe('translationFixtureReplay', () => {
  test.each(TRANSLATION_FIXTURES.map((f) => [f.id, f]))(
    'fixture %s',
    (_id, fixture) => {
      const result = replayTranslationFixture(fixture);
      assertTranslationExpect(result, fixture.expect);
    },
  );
});

describe('splitLongForTranslation', () => {
  test('chunks ~90 words into multiple segments', () => {
    const words = Array.from({ length: 90 }, (_, i) => `word${i}`).join(' ');
    const segs = splitLongForTranslation(words, { maxWords: 40 });
    expect(segs.length).toBeGreaterThanOrEqual(2);
    // v4.94.0 hard ceiling: explicit maxWords 40 clamps to 24 words max.
    segs.forEach((s) => expect(s.split(/\s+/).length).toBeLessThanOrEqual(24));
  });
});
