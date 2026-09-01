import { discardPersistedPassthroughEntries } from './useTranslate';

describe('discardPersistedPassthroughEntries', () => {
  test('drops an old English echo from the Spanish translation cache', () => {
    const source = 'Please confirm your date of birth.';
    const entries = {
      echoed: { sourceText: source, text: source },
      valid: { sourceText: 'Hello.', text: 'Hola.' },
    };
    expect(discardPersistedPassthroughEntries(entries, 'en', 'es')).toEqual({
      valid: entries.valid,
    });
  });
});
