import {
  buildEngineChain,
  blacklistEngine,
  isEngineBlocked,
  isBrowserFetchError,
  isRateLimitError,
  classifyEngineFailure,
  translateWithFallback,
  clearSessionEngineBlacklist,
  getAzureStatusLabel,
  isAzureFallbackOnly,
} from './translationEngines';
import { isTranslationPassthrough } from './translationQuality';

describe('translationEngines v4.54', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearSessionEngineBlacklist();
  });

  test('buildEngineChain excludes lingva', () => {
    const chain = buildEngineChain('en', 'es', {});
    expect(chain).not.toContain('lingva');
    expect(chain).toEqual(['google_gtx', 'mymemory']);
  });

  test('buildEngineChain puts azure after deepl when both keys present', () => {
    const chain = buildEngineChain('en', 'es', { DEEPL: 'x', AZURE: 'x' });
    expect(chain.indexOf('deepl')).toBeLessThan(chain.indexOf('azure'));
    expect(chain).toContain('azure');
  });

  test('translateWithFallback uses azure when configured', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ translations: [{ text: 'Hola mundo', to: 'es' }] }],
    });

    const result = await translateWithFallback({
      text: 'Hello world',
      sLang: 'en',
      tLang: 'es',
      keys: { AZURE: 'test-key', AZURE_REGION: 'brazilsouth' },
    });

    expect(result.quality).toBe('ok');
    expect(result.text).toBe('Hola mundo');
    expect(result.engineId).toBe('azure');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.cognitive.microsofttranslator.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Ocp-Apim-Subscription-Key': 'test-key',
          'Ocp-Apim-Subscription-Region': 'brazilsouth',
        }),
      }),
    );
  });

  test('isBrowserFetchError detects Failed to fetch', () => {
    expect(isBrowserFetchError(new TypeError('Failed to fetch'))).toBe(true);
  });

  test('isRateLimitError detects 429 in message', () => {
    expect(isRateLimitError(new Error('mymemory 429'))).toBe(true);
  });

  test('classifyEngineFailure for network', () => {
    expect(classifyEngineFailure(new TypeError('Failed to fetch'))).toBe('cors_or_network');
  });

  test('classifyEngineFailure maps 401/403 to unauthorized', () => {
    expect(classifyEngineFailure(new Error('azure 401'))).toBe('unauthorized');
    expect(classifyEngineFailure(new Error('azure 403'))).toBe('unauthorized');
    expect(isRateLimitError(new Error('azure 403'))).toBe(false);
  });

  test('getAzureStatusLabel: ok only after success', async () => {
    localStorage.setItem('AZURE_TRANSLATOR_KEY', 'test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ translations: [{ text: 'Hola', to: 'es' }] }],
    });
    await translateWithFallback({
      text: 'Hi',
      sLang: 'en',
      tLang: 'es',
      keys: { AZURE: 'test-key', AZURE_REGION: 'brazilsouth' },
    });
    expect(getAzureStatusLabel()).toBe('Azure: ok');
  });

  test('azure 401 records unauthorized and fallback-only', async () => {
    localStorage.setItem('AZURE_TRANSLATOR_KEY', 'bad-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    blacklistEngine('google_gtx', 60000, 'error');
    blacklistEngine('mymemory', 60000, 'error');

    await translateWithFallback({
      text: 'Hello',
      sLang: 'en',
      tLang: 'es',
      keys: { AZURE: 'bad-key', AZURE_REGION: 'brazilsouth' },
    });

    expect(getAzureStatusLabel()).toBe('Azure: unauthorized / key-region mismatch');
    expect(isAzureFallbackOnly()).toBe(true);
  });

  test('blacklistEngine blocks via sessionStorage', () => {
    blacklistEngine('mymemory', 60000);
    expect(isEngineBlocked('mymemory')).toBe(true);
  });

  test('translateWithFallback weak accept on short passthrough last engine', async () => {
    blacklistEngine('mymemory', 60000);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [[['No.', 'No.', null, null]]],
    });

    const result = await translateWithFallback({
      text: 'No.',
      sLang: 'en',
      tLang: 'es',
      keys: {},
      acceptFn: (src, out, s, t) =>
        isTranslationPassthrough(src, out, s, t) ? '' : out,
    });

    expect(result.quality).toBe('weak');
    expect(result.text).toBe('No.');
    expect(result.engineId).toBe('google_gtx');
  });

  test('translateWithFallback weak accept on long passthrough when all reject', async () => {
    const longEn =
      'Your call may be recorded for quality assurance and training purposes thank you for holding';
    const echoed = longEn;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [[['echo', echoed, null, null]]],
    });

    const result = await translateWithFallback({
      text: longEn,
      sLang: 'en',
      tLang: 'es',
      keys: {},
      acceptFn: () => '',
    });

    expect(result.quality).toBe('weak');
    expect(result.text.length).toBeGreaterThan(0);
  });

  test('translateWithFallback retries free engines when chain was empty (transient only)', async () => {
    blacklistEngine('google_gtx', 60000, 'cors_or_network');
    blacklistEngine('mymemory', 60000, 'cors_or_network');
    expect(buildEngineChain('en', 'es', {})).toEqual([]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [[['Hola', 'Hola', null, null]]],
    });

    const result = await translateWithFallback({
      text: 'Hello',
      sLang: 'en',
      tLang: 'es',
      keys: {},
    });

    expect(result.quality).toBe('ok');
    expect(result.text).toBe('Hola');
  });

  test('translateWithFallback does not retry rate-limited engines', async () => {
    blacklistEngine('google_gtx', 60000, 'rate_limit');
    blacklistEngine('mymemory', 60000, 'rate_limit');
    expect(buildEngineChain('en', 'es', {})).toEqual([]);

    global.fetch = jest.fn();

    const result = await translateWithFallback({
      text: 'Hello',
      sLang: 'en',
      tLang: 'es',
      keys: {},
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.quality).toBe('failed');
  });
});
