import {
  classifyHealthScore,
  formatHealthDisplay,
  truncateDeviceLabel,
  createTestToneUrl,
  isLocalOnlySoundboardPlayback,
  getPreflightSteps,
  isPreflightReady,
  isClipHealthOk,
  scoreTranscriptRecall,
  analyzeClipLegibility,
} from './audioSelfTest';

describe('audioSelfTest', () => {
  test('classifyHealthScore peaches at high confidence', () => {
    expect(classifyHealthScore(0.95).label).toBe('PEACHES');
  });

  test('truncateDeviceLabel shortens long names', () => {
    expect(truncateDeviceLabel('Very Long Device Name Here', 10).length).toBeLessThanOrEqual(10);
  });

  test('formatHealthDisplay adds emoji tiers', () => {
    expect(formatHealthDisplay(0.95)?.label).toContain('PEACHES');
    expect(formatHealthDisplay(0.1)?.label).toContain('UNACCEPTABLE');
    expect(formatHealthDisplay(undefined)).toBeNull();
  });

  test('createTestToneUrl builds wav buffer', () => {
    if (typeof URL.createObjectURL !== 'function') {
      expect(createTestToneUrl).toBeDefined();
      return;
    }
    const url = createTestToneUrl(100);
    expect(url).toMatch(/^blob:/);
    URL.revokeObjectURL(url);
  });

  test('isLocalOnlyPlayback when mic mode only', () => {
    expect(isLocalOnlySoundboardPlayback(false)).toBe(false);
    expect(isLocalOnlySoundboardPlayback(true)).toBe(true);
  });

  test('getPreflightSteps quality and caller gates', () => {
    const missing = getPreflightSteps({ hasClip: false, healthScore: undefined, callPathOk: false, awaitingConfirm: false });
    expect(missing.quality).toBe('missing');
    expect(missing.caller).toBe('missing');

    const ready = getPreflightSteps({ hasClip: true, healthScore: 0.92, callPathOk: true, awaitingConfirm: false });
    expect(ready.quality).toBe('ok');
    expect(ready.caller).toBe('ok');
    expect(isPreflightReady(ready)).toBe(true);

    const confirm = getPreflightSteps({ hasClip: true, healthScore: 0.8, callPathOk: false, awaitingConfirm: true });
    expect(confirm.caller).toBe('confirm');
    expect(isClipHealthOk(0.49)).toBe(false);
    expect(isClipHealthOk(0.5)).toBe(true);
  });

  test('scoreTranscriptRecall matches heard words vs script', () => {
    expect(scoreTranscriptRecall('Hello this is your interpreter', 'Hello, this is your interpreter. How can I help you today?')).toBeCloseTo(5 / 11);
    expect(scoreTranscriptRecall('', 'Hello there')).toBe(0);
    expect(scoreTranscriptRecall('anything', '')).toBe(1);
    expect(scoreTranscriptRecall('BUENO', 'bueno')).toBe(1);
  });

  test('analyzeClipLegibility weights confidence by recall', async () => {
    const heard = 'Thank you for holding I appreciate your patience';
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: { channels: [{ alternatives: [{ confidence: 0.95, transcript: heard }] }] } }),
    }));
    const r = await analyzeClipLegibility(new Blob(['x']), 'k', 'Thank you for holding. I appreciate your patience.');
    expect(r.transcript).toBe(heard);
    expect(r.recall).toBe(1);
    expect(r.score).toBeCloseTo(0.95);
    const wrong = await analyzeClipLegibility(new Blob(['x']), 'k', 'Thank you for holding. I appreciate your patience.');
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: { channels: [{ alternatives: [{ confidence: 0.99, transcript: 'blah blah blah blah' }] }] } }),
    }));
    const w = await analyzeClipLegibility(new Blob(['x']), 'k', 'Thank you for holding. I appreciate your patience.');
    expect(w.score).toBeLessThan(0.5);
    expect(wrong.score).toBeGreaterThan(w.score);
    delete global.fetch;
  });
});
