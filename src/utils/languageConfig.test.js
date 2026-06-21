import {
  DEFAULT_PAIR,
  LANG_PAIR_STORAGE_KEY,
  formatPairShort,
  getOppositeLang,
  isEnEsProtectionMode,
  loadLanguagePair,
  normalizeLang,
  saveLanguagePair,
  shouldReverseBubble,
} from './languageConfig';

describe('languageConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('normalizeLang strips region', () => {
    expect(normalizeLang('en-US')).toBe('en');
    expect(normalizeLang('es-419')).toBe('es');
    expect(normalizeLang('multi')).toBe('en');
  });

  test('isEnEsProtectionMode only for en+es pair', () => {
    expect(isEnEsProtectionMode({ left: 'en', right: 'es' })).toBe(true);
    expect(isEnEsProtectionMode({ left: 'es', right: 'en' })).toBe(true);
    expect(isEnEsProtectionMode({ left: 'en', right: 'fr' })).toBe(false);
    expect(isEnEsProtectionMode({ left: 'fr', right: 'de' })).toBe(false);
  });

  test('shouldReverseBubble follows pair.right', () => {
    expect(shouldReverseBubble('es', { left: 'en', right: 'es' })).toBe(true);
    expect(shouldReverseBubble('en', { left: 'en', right: 'es' })).toBe(false);
    expect(shouldReverseBubble('fr', { left: 'en', right: 'fr' })).toBe(true);
  });

  test('getOppositeLang swaps within pair', () => {
    expect(getOppositeLang('en', { left: 'en', right: 'es' })).toBe('es');
    expect(getOppositeLang('es', { left: 'en', right: 'es' })).toBe('en');
    expect(getOppositeLang('en', { left: 'en', right: 'fr' })).toBe('fr');
  });

  test('save/load round-trip', () => {
    const saved = saveLanguagePair({ left: 'en', right: 'fr' });
    expect(saved).toEqual({ left: 'en', right: 'fr' });
    expect(loadLanguagePair()).toEqual({ left: 'en', right: 'fr' });
    expect(localStorage.getItem(LANG_PAIR_STORAGE_KEY)).toBeTruthy();
  });

  test('load defaults when missing', () => {
    expect(loadLanguagePair()).toEqual(DEFAULT_PAIR);
  });

  test('formatPairShort', () => {
    expect(formatPairShort({ left: 'en', right: 'es' })).toBe('EN | ES');
    expect(formatPairShort({ left: 'en-US', right: 'fr' })).toBe('EN | FR');
  });
});
