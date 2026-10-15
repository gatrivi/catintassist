import { renderHook, act } from '@testing-library/react';

const mockTranslateWithFallback = jest.fn();

jest.mock('../utils/translationEngines', () => ({
  translateWithFallback: (...args) => mockTranslateWithFallback(...args),
}));

import { useTranslate } from './useTranslate';

// The live-loop bug: "Okay." -> "Okay." was rejected as an echo AFTER the cache
// read, so the rejected value stayed cached and every later occurrence of the
// phrase refetched it. These cases pin the fixed behaviour — a stock phrase is
// requested once, and a segment that keeps failing stops being requested.
describe('useTranslate request loop', () => {
  beforeEach(() => {
    mockTranslateWithFallback.mockReset();
    localStorage.clear();
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // mood 'fast' keeps the 300 ms debounce; a new captionId forces a fresh round
  // for text the hook already translated.
  const renderTranslation = (text, opts = {}) =>
    renderHook(({ t, id }) => useTranslate(t, 'en', null, false, 'fast', 0, { ...opts, captionId: id }), {
      initialProps: { t: text, id: opts.captionId || 'cap-1' },
    });

  const settle = async () => {
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await act(async () => {
      await Promise.resolve();
    });
  };


  // Pinned-term mode rewrites the source before it is sent. That rewrite used to
  // assign to a `const`, which THREW inside the debounce callback: the whole
  // turn's translation died silently, no engine call at all.
  it('applies a pinned glossary phrase instead of killing the turn', async () => {
    localStorage.setItem('catint_glossary_mode_v1', 'phrase');
    const key = 'gl:en:es:behavioral health';
    localStorage.setItem(
      'catint_corrections_v1',
      JSON.stringify({
        [key]: {
          sourceHeard: 'behavioral health',
          corrected: 'salud conductual',
          lang: 'en',
          targetLang: 'es',
          kind: 'glossary',
          createdAt: 1,
          key,
        },
      }),
    );
    mockTranslateWithFallback.mockResolvedValue({
      text: 'Hablamos de salud conductual hoy.',
      engineId: 'local',
      quality: 'ok',
      failures: [],
      tried: ['local'],
    });

    const { result } = renderTranslation('We discussed behavioral health today.');
    await settle();

    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(1);
    expect(mockTranslateWithFallback.mock.calls[0][0].text).toContain('salud conductual');
    expect(result.current.translation).toBe('Hablamos de salud conductual hoy.');
  });
  it('accepts a stock phrase and never requests it twice', async () => {
    mockTranslateWithFallback.mockResolvedValue({
      text: 'Okay.',
      engineId: 'local',
      quality: 'ok',
      failures: [],
      tried: ['local'],
    });

    const { result, rerender } = renderTranslation('Okay.');
    await settle();

    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(1);
    // Engine identity on the first round: the phrase itself was accepted, not
    // replaced by the source-text fallback.
    expect(result.current.translationMeta.engineId).toBe('local');

    await act(async () => {
      rerender({ t: 'Okay.', id: 'cap-2' });
      jest.advanceTimersByTime(400);
    });
    await settle();

    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(1);
    expect(result.current.translationMeta.quality).toBe('ok');
    expect(result.current.translation).toBe('Okay.');
  });

  it('stops requesting a segment that keeps failing', async () => {
    const broken = 'The cardiology department will call you back tomorrow afternoon.';
    mockTranslateWithFallback.mockResolvedValue({
      text: '',
      engineId: null,
      quality: 'failed',
      failures: [{ id: 'local', reason: 'server_error' }],
      tried: ['local', 'gateway'],
    });

    const { result, rerender } = renderTranslation(broken);
    await settle();
    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(1);

    for (let round = 2; round <= 3; round += 1) {
      await act(async () => {
        rerender({ t: broken, id: `cap-${round}` });
        jest.advanceTimersByTime(400);
      });
      await settle();
    }
    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(3);

    // Fourth occurrence: quarantined, no request.
    await act(async () => {
      rerender({ t: broken, id: 'cap-4' });
      jest.advanceTimersByTime(400);
    });
    await settle();

    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(3);
    expect(result.current.translationMeta.quality).toBe('failed');
  });

  it('clears the failure mark once the segment translates', async () => {
    const flaky = 'Please hold while I check your insurance coverage.';
    const failed = {
      text: '',
      engineId: null,
      quality: 'failed',
      failures: [{ id: 'local', reason: 'server_error' }],
      tried: ['local'],
    };
    mockTranslateWithFallback.mockResolvedValue(failed);

    const { rerender } = renderTranslation(flaky);
    await settle(); // mount round — failure 1
    await act(async () => {
      rerender({ t: flaky, id: 'flaky-2' });
      jest.advanceTimersByTime(400);
    });
    await settle();
    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(2);

    mockTranslateWithFallback.mockResolvedValue({
      text: 'Espere un momento mientras reviso su cobertura del seguro.',
      engineId: 'local',
      quality: 'ok',
      failures: [],
      tried: ['local'],
    });

    await act(async () => {
      rerender({ t: flaky, id: 'flaky-3' });
      jest.advanceTimersByTime(400);
    });
    await settle();
    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(3);

    // Later occurrences are served from cache, not the failure counter.
    await act(async () => {
      rerender({ t: flaky, id: 'flaky-4' });
      jest.advanceTimersByTime(400);
    });
    await settle();
    expect(mockTranslateWithFallback).toHaveBeenCalledTimes(3);
  });
});
