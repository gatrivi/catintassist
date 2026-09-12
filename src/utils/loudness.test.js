import { classifyLoudness, measureChannelLoudness, measureChoppiness, classifyChoppiness } from './loudness';

describe('classifyLoudness', () => {
  test('no data → UNTESTED', () => {
    expect(classifyLoudness().label).toBe('UNTESTED');
    expect(classifyLoudness(undefined).label).toBe('UNTESTED');
    expect(classifyLoudness(NaN).label).toBe('UNTESTED');
  });

  test('loud speech → PEACHES (full bar)', () => {
    const r = classifyLoudness(-10, -2);
    expect(r.label).toBe('PEACHES');
    expect(r.width).toBe('100%');
    expect(r.color).toBe('#10b981');
  });

  test('usable speech → GOOD', () => {
    expect(classifyLoudness(-20, -3).label).toBe('GOOD');
  });

  test('quiet but workable → SOFT', () => {
    expect(classifyLoudness(-26, -4).label).toBe('SOFT');
  });

  test('dangerously quiet → TOO QUIET', () => {
    const r = classifyLoudness(-40, -10);
    expect(r.label).toBe('TOO QUIET');
    expect(r.width).toBe('25%');
  });

  test('near-zero waveform → SILENT wins over RMS tier', () => {
    expect(classifyLoudness(-30, -50).label).toBe('SILENT');
    expect(classifyLoudness(-20, -60).label).toBe('SILENT');
  });
});

describe('measureChannelLoudness', () => {
  test('silence floors at −180 dB (1e-9 guard)', () => {
    const m = measureChannelLoudness(new Float32Array(1000));
    expect(m.rmsDb).toBe(-180);
    expect(m.peakDb).toBe(-180);
    // and classifies as SILENT
    expect(classifyLoudness(m.rmsDb, m.peakDb).label).toBe('SILENT');
  });

  test('empty channel → -Infinity (early return)', () => {
    const m = measureChannelLoudness(new Float32Array(0));
    expect(m.rmsDb).toBe(-Infinity);
  });

  test('constant 0.25 → −12 dB RMS and peak', () => {
    const m = measureChannelLoudness(new Float32Array(1000).fill(0.25));
    expect(m.rmsDb).toBeCloseTo(-12.0, 1);
    expect(m.peakDb).toBeCloseTo(-12.0, 1);
  });

  test('0.5 sine → −9 dB RMS (A/√2), peak −6 dB', () => {
    const n = 48000; // 1s @ 48kHz, 1000Hz = integer cycles
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i += 1) ch[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / n);
    const m = measureChannelLoudness(ch);
    expect(m.rmsDb).toBeCloseTo(-9.0, 1);
    expect(m.peakDb).toBeCloseTo(-6.0, 1);
  });
});

describe('measureChoppiness', () => {
  // pulse train: 0.5-amplitude sine bursts of burstS separated by gaps of gapS
  const pulses = (burstS, gapS, cycles, sr = 48000) => {
    const burst = Math.round(burstS * sr);
    const gap = Math.round(gapS * sr);
    const out = new Float32Array((burst + gap) * cycles);
    for (let c = 0; c < cycles; c += 1) {
      const start = c * (burst + gap);
      for (let i = 0; i < burst; i += 1) out[start + i] = 0.5 * Math.sin((2 * Math.PI * 500 * i) / sr);
    }
    return out;
  };

  test('silent clip → no events', () => {
    const m = measureChoppiness(new Float32Array(48000));
    expect(m.dropouts).toBe(0);
    expect(m.activeSecs).toBe(0);
  });

  test('garbled staccato (80ms bursts / 60ms gaps) → CHOPPY', () => {
    const m = measureChoppiness(pulses(0.08, 0.06, 20));
    expect(m.dropouts).toBeGreaterThan(10);
    expect(classifyChoppiness(m.per10s).label).toBe('CHOPPY');
  });

  test('natural words (300ms bursts / 250ms pauses) → SMOOTH', () => {
    const m = measureChoppiness(pulses(0.3, 0.25, 6));
    expect(m.dropouts).toBe(0);
    expect(classifyChoppiness(m.per10s).label).toBe('SMOOTH');
  });

  test('short stop-consonant gap inside long bursts → SMOOTH', () => {
    const m = measureChoppiness(pulses(0.3, 0.06, 8));
    expect(m.dropouts).toBe(0);
  });

  test('continuous speech (no gaps) → SMOOTH', () => {
    const m = measureChoppiness(pulses(4.0, 0.0, 1));
    expect(m.dropouts).toBe(0);
  });
});

describe('classifyChoppiness', () => {
  test('tier mapping', () => {
    expect(classifyChoppiness(10).label).toBe('CHOPPY');
    expect(classifyChoppiness(10).width).toBe('25%');
    expect(classifyChoppiness(4).label).toBe('SLIGHT CHOP');
    expect(classifyChoppiness(1).label).toBe('SMOOTH');
    expect(classifyChoppiness(1).width).toBe('100%');
  });

  test('no data → UNTESTED', () => {
    expect(classifyChoppiness().label).toBe('UNTESTED');
    expect(classifyChoppiness(NaN).label).toBe('UNTESTED');
  });
});
