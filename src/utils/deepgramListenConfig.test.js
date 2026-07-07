import {
  STT_LATENCY_MODES,
  buildListenUrl,
  getInterimFlushMs,
  getInterimProcessThrottleMs,
  getMediaRecorderTimeslice,
  loadSttLatencyMode,
  saveSttLatencyMode,
  toggleSttLatencyMode,
} from './deepgramListenConfig';

describe('deepgramListenConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to fast mode', () => {
    expect(loadSttLatencyMode()).toBe('fast');
  });

  test('buildListenUrl includes words and mode endpointing', () => {
    const fast = buildListenUrl('en', 'fast');
    expect(fast).toContain('words=true');
    expect(fast).toContain('endpointing=150');
    const bal = buildListenUrl('es', 'balanced');
    expect(bal).toContain('endpointing=300');
  });

  test('fast mode uses aggressive timings', () => {
    expect(getMediaRecorderTimeslice('fast')).toBe(100);
    expect(getInterimProcessThrottleMs('fast')).toBe(100);
    expect(getInterimFlushMs('fast')).toBe(100);
    expect(STT_LATENCY_MODES.balanced.mediaRecorderMs).toBe(250);
  });

  test('save and toggle persist mode', () => {
    saveSttLatencyMode('balanced');
    expect(loadSttLatencyMode()).toBe('balanced');
    expect(toggleSttLatencyMode()).toBe('fast');
    expect(loadSttLatencyMode()).toBe('fast');
  });
});
