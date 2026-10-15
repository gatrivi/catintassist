import { renderHook, act } from '@testing-library/react';

// v4.178.0 latency fixes. Fake engine answers in ENGINE_MS, like the local
// server (127.0.0.1:59200 ~0.1-0.2 s per sentence).
const ENGINE_MS = 150;
const mockTranslateWithFallback = jest.fn();
jest.mock('../utils/translationEngines', () => ({
  translateWithFallback: (...args) => mockTranslateWithFallback(...args),
}));

import { useTranslate, resolveTranslateDebounceMs } from './useTranslate';

const ES = {
  'The doctor will see you now.': 'El médico lo verá ahora.',
  'Please bring your card.': 'Por favor traiga su tarjeta.',
  'Your appointment is on Monday.': 'Su cita es el lunes.',
  'Your blood pressure looks a lot better this week.': 'Su presión se ve mucho mejor esta semana.',
  'Keep taking the pills.': 'Siga tomando las pastillas.',
};
const THREE = Object.keys(ES).slice(0, 3).join(' ');

// Resolves after ENGINE_MS; honours the abort signal like a real fetch.
const slowEngine = ({ text, signal }) =>
  new Promise((resolve) => {
    const t = setTimeout(
      () => resolve({ text: ES[text] || `ES:${text}`, engineId: 'local', quality: 'ok', failures: [], tried: ['local'] }),
      ENGINE_MS,
    );
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve({ text: '', engineId: null, quality: 'failed', failures: [], tried: [] });
    });
  });

const tick = async (ms) => {
  await act(async () => { jest.advanceTimersByTime(ms); });
  await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
};

beforeEach(() => {
  mockTranslateWithFallback.mockReset();
  mockTranslateWithFallback.mockImplementation(slowEngine);
  localStorage.clear();
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const render = (text, isFinal, id = 'cap-lat') =>
  renderHook(({ t, f }) => useTranslate(t, 'en', null, false, 'auto', 0, { isFinal: f, captionId: id }), {
    initialProps: { t: text, f: isFinal },
  });

// Steps the clock in 10 ms slices until `done` is true; returns elapsed ms.
const msUntil = async (done, max = 3000) => {
  let ms = 0;
  while (!done() && ms < max) { await tick(10); ms += 10; }
  return ms;
};

describe('fix 2 — sealed text skips the debounce', () => {
  test('final / punctuated text sends at 0 ms; interim keeps the auto wait', () => {
    expect(resolveTranslateDebounceMs({ isSplitRewrite: false, forceTrigger: true, mood: 'auto', isSealed: true })).toBe(0);
    expect(resolveTranslateDebounceMs({ isSplitRewrite: false, forceTrigger: true, mood: 'auto', isSealed: false })).toBe(800);
  });
});

describe('fix 1 — progressive display', () => {
  test('sentence 1 is on screen before sentence 3 is translated', async () => {
    const { result } = render(THREE, true);
    const firstMs = await msUntil(() => result.current.translation.includes('El médico'));
    expect(result.current.translation).not.toContain('lunes');
    const fullMs = firstMs + (await msUntil(() => result.current.translation.includes('lunes')));
    // Measured: STT final -> first sentence / full translation on screen.
    // Before v4.178.0: ~1250 ms for both (800 debounce + 3 x 150 sequential, one paint).
    console.log(`[latency] final->first ${firstMs} ms, final->full ${fullMs} ms`);
    expect(firstMs).toBeLessThanOrEqual(ENGINE_MS + 30);
    expect(fullMs).toBeLessThanOrEqual(3 * ENGINE_MS + 60);
  });
});

// Fresh sentences (the in-memory cache already holds the ones above), and the
// interim must carry >=10 words to pass the auto-mode gate.
const S1 = 'Your blood pressure looks a lot better this week.';
const GROW = `${S1} Keep taking the`;
describe('fix 4 — only the growing tail is aborted', () => {
  test('a finished sentence survives a newer interim and is reused, not refetched', async () => {
    const { result, rerender } = render(GROW, false, 'cap-g1');
    await tick(820); // auto-mode interim debounce, then the request starts
    // Interim grows while sentence 1 is in flight.
    rerender({ t: `${S1} Keep taking the pills.`, f: true });
    await msUntil(() => result.current.translation.includes('pastillas'));

    const sentOne = mockTranslateWithFallback.mock.calls.filter((c) => c[0].text === S1);
    expect(sentOne).toHaveLength(1); // joined via dedupeInFlight / cache
    expect(sentOne[0][0].signal).toBeUndefined(); // finished segment: not abortable
    expect(result.current.translation).toBe('Su presión se ve mucho mejor esta semana. Siga tomando las pastillas.');
  });

  test('the interim tail is abortable', async () => {
    render('Please call me back about the refill. Keep taking the', false, 'cap-g2');
    await tick(820);
    await tick(ENGINE_MS + 10);
    const tail = mockTranslateWithFallback.mock.calls.find((c) => c[0].text === 'Keep taking the');
    expect(tail?.[0].signal).toBeDefined();
  });
});
