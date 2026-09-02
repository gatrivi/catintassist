import {
  buildEngineChain,
  blacklistEngine,
  isEngineBlocked,
  isBrowserFetchError,
  isRateLimitError,
  classifyEngineFailure,
  translateWithFallback,
  clearSessionEngineBlacklist,
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
    expect(chain).toEqual(['gateway', 'mymemory']);
  });

  test('buildEngineChain keeps paid providers off the browser', () => {
    const chain = buildEngineChain('en', 'es', { DEEPL: 'x', AZURE: 'x' });
    expect(chain).toEqual(['gateway', 'mymemory']);
    expect(chain).not.toEqual(expect.arrayContaining(['azure', 'deepl', 'google_gtx', 'openai']));
  });

  test('gateway failure falls through to the single free browser translation', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ responseData: { translatedText: 'Hola' } }) });

    const result = await translateWithFallback({ text: 'Hello', sLang: 'en', tLang: 'es', keys: {} });

    expect(result).toMatchObject({ text: 'Hola', engineId: 'mymemory', quality: 'ok' });
  });

  test('translateWithFallback never sends configured Azure keys from the browser', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translation: 'Hola mundo' }),
    });

    const result = await translateWithFallback({
      text: 'Hello world',
      sLang: 'en',
      tLang: 'es',
      keys: { AZURE: 'test-key', AZURE_REGION: 'brazilsouth' },
    });

    expect(result.quality).toBe('ok');
    expect(result.text).toBe('Hola mundo');
    expect(result.engineId).toBe('gateway');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/translate',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
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

  test('blacklistEngine blocks via sessionStorage', () => {
    blacklistEngine('mymemory', 60000);
    expect(isEngineBlocked('mymemory')).toBe(true);
  });

  test('translateWithFallback weak accept on short passthrough last engine', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ responseData: { translatedText: 'No.' } }) });

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
    expect(result.engineId).toBe('mymemory');
  });

  test('translateWithFallback weak accept on long passthrough when all reject', async () => {
    const longEn =
      'Your call may be recorded for quality assurance and training purposes thank you for holding';
    const echoed = longEn;

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ responseData: { translatedText: echoed } }) });

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
    blacklistEngine('gateway', 60000, 'cors_or_network');
    blacklistEngine('mymemory', 60000, 'cors_or_network');
    expect(buildEngineChain('en', 'es', {})).toEqual([]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'Hola' } }),
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
    blacklistEngine('gateway', 60000, 'rate_limit');
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
