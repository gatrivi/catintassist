import {
  buildEngineChain,
  blacklistEngine,
  isEngineBlocked,
  isBrowserFetchError,
  isRateLimitError,
  classifyEngineFailure,
  translateWithFallback,
} from './translationEngines';
import { isTranslationPassthrough } from './translationQuality';

describe('translationEngines v4.54', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('buildEngineChain excludes lingva', () => {
    const chain = buildEngineChain('en', 'es', {});
    expect(chain).not.toContain('lingva');
    expect(chain).toEqual(['google_gtx', 'mymemory']);
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
});
