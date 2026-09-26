/**
 * Translation latency (v4.165.0) — the reported "4-6s behind, useless".
 *
 * The arithmetic that matched the symptom exactly: 800ms debounce (auto mood)
 * + 4000ms flat per-engine timeout = 4800ms for ONE dead endpoint. And because a
 * timeout was never blacklisted, that same 4s was paid again on every bubble.
 *
 * Two fixes, both about not paying for silence:
 *   1. remember a hang (90s cooldown) so it is not rediscovered every segment;
 *   2. fail fast on the early attempts, keep the full budget for the last one.
 * Neither trades quality for speed — a healthy engine still wins instantly, and
 * the final engine is still patient.
 */
import {
  engineTimeoutForAttempt,
  ENGINE_TIMEOUT_LADDER_MS,
  blacklistEngine,
  isEngineBlocked,
  clearSessionEngineBlacklist,
} from './translationEngines';
import {
  TRANSLATION_LATENCY_MODES,
  TRANSLATION_LATENCY_LADDERS,
  loadTranslationLatencyMode,
  loadTranslationLatencyLadder,
  saveTranslationLatencyMode,
} from './translationLatencyMode';

describe('translation latency v4.165.0', () => {
  beforeEach(() => {
    clearSessionEngineBlacklist();
    sessionStorage.clear();
  });

  test('the first attempt is snappy, the LAST keeps the full 4s budget', () => {
    expect(engineTimeoutForAttempt(0, 4)).toBe(1200);
    expect(engineTimeoutForAttempt(1, 4)).toBe(2000);
    // never sacrifice quality for speed on the engine that has the last word
    expect(engineTimeoutForAttempt(3, 4)).toBe(4000);
    expect(ENGINE_TIMEOUT_LADDER_MS[ENGINE_TIMEOUT_LADDER_MS.length - 1]).toBe(4000);
  });

  test('a single-engine chain gets the full budget (nothing to fall back to)', () => {
    expect(engineTimeoutForAttempt(0, 1)).toBe(4000);
  });

  test('two dead engines now cost ~5.2s worst case, not 8s', () => {
    const two = engineTimeoutForAttempt(0, 2) + engineTimeoutForAttempt(1, 2);
    expect(two).toBeLessThan(4000 + 4000);
    expect(two).toBe(1200 + 4000);
  });

  test('a hanging engine is REMEMBERED, not rediscovered every bubble', () => {
    // This is the actual bug: timeouts were not blacklisted, so the same dead
    // endpoint cost the full timeout again for every single segment, all day.
    expect(isEngineBlocked('hanging_engine')).toBe(false);
    blacklistEngine('hanging_engine', undefined, 'timeout');
    expect(isEngineBlocked('hanging_engine')).toBe(true);
  });

  test('the timeout cooldown is short enough to self-heal (not a 24h ban)', () => {
    blacklistEngine('flaky', undefined, 'timeout');
    const until = JSON.parse(sessionStorage.getItem('catint_trans_engine_blacklist_v1')).flaky
      .until;
    const cooldown = until - Date.now();
    expect(cooldown).toBeGreaterThan(30 * 1000); // enough to stop the bleeding
    expect(cooldown).toBeLessThan(10 * 60 * 1000); // but it comes back on its own
  });

  test('a fast engine is still preferred — we only cut off the slow ones', () => {
    // the ladder's first slice is longer than any real engine's response
    expect(engineTimeoutForAttempt(0, 3)).toBeGreaterThan(900);
  });
});

describe('operator latency picker (v4.167.0)', () => {
  beforeEach(() => localStorage.clear());

  test('FAST is the default — in live interpreting every second is a sentence behind', () => {
    expect(loadTranslationLatencyMode()).toBe('fast');
    expect(loadTranslationLatencyLadder()).toEqual([700, 1200, 2000]);
  });

  test('the first engine is never 4s unless you deliberately pick PATIENT', () => {
    expect(TRANSLATION_LATENCY_LADDERS.fast[0]).toBeLessThan(4000);
    expect(TRANSLATION_LATENCY_LADDERS.balanced[0]).toBeLessThan(4000);
    // PATIENT is the explicit opt-in to the old behaviour, kept for rare segments
    expect(TRANSLATION_LATENCY_LADDERS.patient[0]).toBe(4000);
    saveTranslationLatencyMode('balanced');
    expect(loadTranslationLatencyLadder()[0]).toBeLessThan(4000);
  });

  test('each mode round-trips, junk falls back to fast', () => {
    TRANSLATION_LATENCY_MODES.forEach((m) => {
      expect(saveTranslationLatencyMode(m)).toBe(m);
      expect(loadTranslationLatencyMode()).toBe(m);
    });
    expect(saveTranslationLatencyMode('nonsense')).toBe('fast');
  });

  test('a broken storage stays FAST (never silently back to 4s)', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    expect(loadTranslationLatencyMode()).toBe('fast');
    spy.mockRestore();
  });

  test('the chosen ladder actually drives the per-attempt timeout', () => {
    const fast = TRANSLATION_LATENCY_LADDERS.fast;
    expect(engineTimeoutForAttempt(0, 3, fast)).toBe(700);
    expect(engineTimeoutForAttempt(1, 3, fast)).toBe(1200);
    expect(engineTimeoutForAttempt(2, 3, fast)).toBe(2000);
    // PATIENT keeps the old patient behaviour for rare hard segments
    expect(engineTimeoutForAttempt(0, 3, TRANSLATION_LATENCY_LADDERS.patient)).toBe(4000);
  });
});
