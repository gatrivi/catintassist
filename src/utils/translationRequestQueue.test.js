import { TRANSLATION_MAX_SLOTS } from './translationRequestQueue';

test('translation requests are serialized to protect free engines', () => {
  expect(TRANSLATION_MAX_SLOTS).toBe(1);
});
