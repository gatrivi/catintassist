import { classifyLoudness, measureChannelLoudness } from './loudness';

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
