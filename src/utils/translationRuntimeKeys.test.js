import { getTranslationApiKeys, getTranslationKeyStatus } from './translationRuntimeKeys';

describe('translationRuntimeKeys', () => {
  const orig = { ...process.env };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    process.env = { ...orig };
  });

  afterAll(() => {
    process.env = orig;
  });

  test('env azure key wins over localStorage', () => {
    process.env.REACT_APP_AZURE_TRANSLATOR_KEY = 'env-azure';
    process.env.REACT_APP_AZURE_TRANSLATOR_REGION = 'brazilsouth';
    localStorage.setItem('AZURE_TRANSLATOR_KEY', 'stored-azure');

    expect(getTranslationApiKeys().AZURE).toBe('env-azure');
    expect(getTranslationKeyStatus().sources.azure).toBe('env');
  });

  test('falls back to localStorage when env empty', () => {
    delete process.env.REACT_APP_AZURE_TRANSLATOR_KEY;
    localStorage.setItem('AZURE_TRANSLATOR_KEY', 'stored-azure');
    expect(getTranslationApiKeys().AZURE).toBe('stored-azure');
    expect(getTranslationKeyStatus().sources.azure).toBe('settings');
  });

  test('default azure region', () => {
    expect(getTranslationApiKeys().AZURE_REGION).toBe('brazilsouth');
  });
});
