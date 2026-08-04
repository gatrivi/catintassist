import {
  STT_LATENCY_MODES,
  buildListenUrl,
  getInterimFlushMs,
  getInterimProcessThrottleMs,
  getMediaRecorderTimeslice,
  getMediaRecorderOptions,
  buildAudioOnlyStream,
  getDeepgramModel,
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
    expect(fast).toContain('model=nova-3-general');
    expect(fast).toContain('numerals=true');
    expect(fast).toContain('filler_words=true');
    expect(fast).toContain('words=true');
    expect(fast).toContain('endpointing=150');
    const bal = buildListenUrl('es', 'balanced');
    expect(bal).toContain('model=nova-3-general');
    expect(bal).toContain('endpointing=300');
  });

  test('uses nova-3-general for all lanes (medical+filler_words unsupported)', () => {
    expect(getDeepgramModel('en-US')).toBe('nova-3-general');
    expect(getDeepgramModel('es-419')).toBe('nova-3-general');
    expect(getDeepgramModel('multi')).toBe('nova-3-general');
  });

  test('buildAudioOnlyStream strips video tracks', () => {
    if (typeof MediaStream === 'undefined') return;
    const audio = { kind: 'audio', enabled: true, muted: false };
    const video = { kind: 'video', enabled: true, muted: false };
    const stream = {
      getAudioTracks: () => [audio],
      getVideoTracks: () => [video],
    };
    const audioOnly = buildAudioOnlyStream(stream);
    expect(audioOnly).not.toBeNull();
    expect(audioOnly.getAudioTracks()).toEqual([audio]);
    expect(audioOnly.getVideoTracks()).toEqual([]);
  });

  test('getMediaRecorderOptions prefers webm/opus when supported', () => {
    const opts = getMediaRecorderOptions();
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      expect(opts?.mimeType).toBe('audio/webm;codecs=opus');
    } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) {
      expect(opts?.mimeType).toBe('audio/webm');
    } else {
      expect(opts).toBeUndefined();
    }
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
