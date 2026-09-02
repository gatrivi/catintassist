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

  test('buildEngineChain uses only the local translator and our gateway', () => {
    const chain = buildEngineChain('en', 'es', {});
    expect(chain).not.toContain('lingva');
    expect(chain).toEqual(['local_stt', 'gateway']);
  });

  test('buildEngineChain keeps paid providers off the browser', () => {
    const chain = buildEngineChain('en', 'es', { DEEPL: 'x', AZURE: 'x' });
    expect(chain).toEqual(['local_stt', 'gateway']);
    expect(chain).not.toEqual(expect.arrayContaining(['azure', 'deepl', 'google_gtx', 'openai']));
  });

  test('local translator failure falls through to our gateway', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translation: 'Hola' }) });

    const result = await translateWithFallback({ text: 'Hello', sLang: 'en', tLang: 'es', keys: {} });

    expect(result).toMatchObject({ text: 'Hola', engineId: 'gateway', quality: 'ok' });
  });

  test('translateWithFallback calls the local translator without provider keys', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hola mundo' }),
    });

    const result = await translateWithFallback({
      text: 'Hello world',
      sLang: 'en',
      tLang: 'es',
      keys: { AZURE: 'test-key', AZURE_REGION: 'brazilsouth' },
    });

    expect(result.quality).toBe('ok');
    expect(result.text).toBe('Hola mundo');
    expect(result.engineId).toBe('local_stt');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:59200/stt/translate',
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
    blacklistEngine('local_stt', 60000);
    expect(isEngineBlocked('local_stt')).toBe(true);
  });

  test('translateWithFallback weak accept on short passthrough last engine', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'No.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translation: 'No.' }) });

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
    expect(result.engineId).toBe('gateway');
  });

  test('translateWithFallback weak accept on long passthrough when all reject', async () => {
    const longEn =
      'Your call may be recorded for quality assurance and training purposes thank you for holding';
    const echoed = longEn;

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: echoed }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translation: echoed }) });

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
    blacklistEngine('local_stt', 60000, 'cors_or_network');
    expect(buildEngineChain('en', 'es', {})).toEqual([]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hola' }),
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
    blacklistEngine('local_stt', 60000, 'rate_limit');
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
