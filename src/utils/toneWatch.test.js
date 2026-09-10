import { analyzeToneFrame, createToneTracker, TONE_CONCENTRATION_MIN, TONE_LEVEL_MIN } from './toneWatch';

describe('analyzeToneFrame', () => {
  const bins = (n = 256) => new Uint8Array(n);

  test('silence → level 0, no concentration', () => {
    const f = analyzeToneFrame(bins(), 48000);
    expect(f.level).toBe(0);
    expect(f.concentration).toBe(0);
  });

  test('empty/missing frame is safe', () => {
    expect(analyzeToneFrame(null).level).toBe(0);
    expect(analyzeToneFrame(new Uint8Array(0)).level).toBe(0);
  });

  test('pure single-bin tone → peak at that bin, high concentration', () => {
    const b = bins(256);
    b[32] = 200; // 256 bins over 24kHz Nyquist → bin 32 ≈ 3000Hz
    b[33] = 60; // spectral leakage neighbor
    const f = analyzeToneFrame(b, 48000);
    expect(f.peakHz).toBe(3000);
    expect(f.concentration).toBeGreaterThan(TONE_CONCENTRATION_MIN);
    expect(f.level).toBeGreaterThan(0);
  });

  test('broadband noise → low concentration (speech-like)', () => {
    const b = bins(256);
    for (let i = 0; i < 256; i++) b[i] = 100 + (i % 17); // near-flat, mild ripple
    const f = analyzeToneFrame(b, 48000);
    expect(f.concentration).toBeLessThan(2);
  });
});

describe('createToneTracker', () => {
  test('ignores quiet or broadband frames', () => {
    const t = createToneTracker();
    t.push({ level: 0.001, peakHz: 3000, concentration: 50 });
    t.push({ level: 0.5, peakHz: 3000, concentration: 1.5 });
    expect(t.summary().toneFrames).toBe(0);
  });

  test('records tone frames and reports dominant bucket', () => {
    const t = createToneTracker();
    const now = Date.now();
    t.push({ level: TONE_LEVEL_MIN + 0.1, peakHz: 1020, concentration: TONE_CONCENTRATION_MIN + 1 }, now);
    t.push({ level: 0.3, peakHz: 1040, concentration: 12 }, now + 200);
    const s = t.summary(now + 300);
    expect(s.toneFrames).toBe(2);
    expect(s.dominantHz).toBe(1000);
    expect(s.log.length).toBe(2);
  });

  test('frames expire outside the window', () => {
    const t = createToneTracker({ windowMs: 60000 });
    const now = Date.now();
    t.push({ level: 0.3, peakHz: 800, concentration: 9 }, now);
    expect(t.summary(now + 61000).toneFrames).toBe(0);
  });
});
