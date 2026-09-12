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
  explainHealth,
  capSinkTestVolume,
  SINK_TEST_TONE_VOL,
  SINK_TEST_CLIP_CAP,
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

  // v4.95.3: unacceptable must explain WHY and HOW to fix.
  test('explainHealth: unheard audio points at mic/noise', () => {
    const e = explainHealth({ score: 0.2, recall: 0.3, confidence: 0.4 });
    expect(e.why).toMatch(/barely hear|weak|noisy/i);
    expect(e.fix).toMatch(/re-record/i);
  });

  test('explainHealth: wrong words point at the script', () => {
    const e = explainHealth({ score: 0.4, recall: 0.4, confidence: 0.9 });
    expect(e.why).toMatch(/did not match the script/i);
    // v4.96.4: the script is shown inline with the failure — no Setup hunt.
    expect(e.fix).not.toMatch(/setup/i);
  });

  test('explainHealth: clean words but muddy audio points at clarity', () => {
    const e = explainHealth({ score: 0.45, recall: 0.9, confidence: 0.4 });
    expect(e.why).toMatch(/unclear|noise|level/i);
  });

  test('explainHealth: passing score has no fix', () => {
    const e = explainHealth({ score: 0.8, recall: 0.9, confidence: 0.9 });
    expect(e.fix).toBe('');
  });

  test('explainHealth: unchecked clip tells you to check or record', () => {
    const e = explainHealth({});
    expect(e.why).toMatch(/not checked/i);
  });

  // v4.106.0: sink test never deafens — soft fixed beep, clip capped low.
  test('capSinkTestVolume clamps into safe range', () => {
    expect(SINK_TEST_TONE_VOL).toBeLessThanOrEqual(0.2);
    expect(SINK_TEST_CLIP_CAP).toBeLessThanOrEqual(0.4);
    expect(capSinkTestVolume(1)).toBe(SINK_TEST_CLIP_CAP);
    expect(capSinkTestVolume(0.1)).toBeCloseTo(0.1);
    expect(capSinkTestVolume(0)).toBe(0);
    expect(capSinkTestVolume(-3)).toBe(0);
    expect(capSinkTestVolume(undefined)).toBe(SINK_TEST_CLIP_CAP);
    expect(capSinkTestVolume('loud')).toBe(SINK_TEST_CLIP_CAP);
  });
});
