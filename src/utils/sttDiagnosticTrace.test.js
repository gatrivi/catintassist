import {
  STT_DIAGNOSTIC_VERSION,
  STT_EVENT_STATUS,
  TRACE_STORAGE_KEY,
  AUDIO_RING_STORAGE_KEY,
  addSttAudioChunk,
  beginSttSession,
  clearSttAudio,
  clearSttTraces,
  createSttAudioUrl,
  endSttSession,
  getRetainedSttAudio,
  getSttDiagnosticSnapshot,
  linkDisplayedCaption,
  readSttDiagnosticSettings,
  recordSttEvent,
  setAudioRingEnabled,
  setSttDiagnosticSettings,
  setTraceEnabled,
  updateSttEvent,
  wipeSttDiagnostics,
} from './sttDiagnosticTrace';

describe('sttDiagnosticTrace v4.148.0', () => {
  beforeEach(() => {
    localStorage.clear();
    wipeSttDiagnostics();
  });

  afterEach(() => {
    localStorage.clear();
    wipeSttDiagnostics();
  });

  it('stores only explicit settings and defaults both captures off', () => {
    expect(readSttDiagnosticSettings()).toEqual({ traceEnabled: false, audioRingEnabled: false });
    setSttDiagnosticSettings({ traceEnabled: true, audioRingEnabled: true });
    expect(localStorage.getItem(TRACE_STORAGE_KEY)).toBe('1');
    expect(localStorage.getItem(AUDIO_RING_STORAGE_KEY)).toBe('1');
    expect(Object.keys(localStorage).filter((key) => key.startsWith('catint.sttDiagnostics.'))).toHaveLength(2);
  });

  it('keeps stable bounded trace events and links displayed captions in memory', () => {
    setTraceEnabled(true);
    const sessionId = beginSttSession();
    const event = recordSttEvent({
      text: 'raw patient words',
      providerStart: 1.25,
      providerDuration: 0.4,
      wallClockMs: 1234,
      lane: 'patient-en',
      socket: 'socket-7',
      confidence: 0.91,
      final: false,
    });
    expect(event.id).toBe(`${sessionId}-event-000001`);
    expect(event.sessionId).toBe(sessionId);
    updateSttEvent(event.id, { status: STT_EVENT_STATUS.COMMITTED });
    linkDisplayedCaption(event.id, 'caption-9', 'displayed patient words');
    const stored = getSttDiagnosticSnapshot().events[0];
    expect(stored.id).toBe(event.id);
    expect(stored.status).toBe('committed');
    expect(stored.linkedCaptionIds).toEqual(['caption-9']);
    expect(stored.displayedCaptions[0].text).toBe('displayed patient words');
    expect(JSON.stringify(localStorage)).not.toContain('raw patient words');
    expect(JSON.stringify(localStorage)).not.toContain('displayed patient words');
  });

  it('caps traces at 200 events', () => {
    setTraceEnabled(true);
    beginSttSession();
    for (let index = 0; index < 205; index += 1) recordSttEvent({ text: `event ${index}` });
    const events = getSttDiagnosticSnapshot().events;
    expect(events).toHaveLength(200);
    expect(events[0].rawText).toBe('event 5');
    expect(events[199].rawText).toBe('event 204');
  });

  it('bounds audio by 60 seconds and 5 MiB and never persists bytes', () => {
    setSttDiagnosticSettings({ traceEnabled: false, audioRingEnabled: true });
    expect(addSttAudioChunk(new Uint8Array(1000), { durationMs: 40001 })).not.toBeNull();
    expect(addSttAudioChunk(new Uint8Array(2000), { durationMs: 20000 })).not.toBeNull();
    let snapshot = getSttDiagnosticSnapshot();
    expect(snapshot.audioChunks).toHaveLength(1);
    expect(snapshot.audioDurationMs).toBe(20000);
    expect(addSttAudioChunk(new Uint8Array(5 * 1024 * 1024 + 1))).toBeNull();
    expect(addSttAudioChunk(new Uint8Array(2 * 1024 * 1024), { durationMs: 1 })).not.toBeNull();
    snapshot = getSttDiagnosticSnapshot();
    expect(snapshot.audioBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(JSON.stringify(localStorage)).not.toContain('audio/webm');
  });

  it('automatically clears audio when disabled or cleared', () => {
    setAudioRingEnabled(true);
    addSttAudioChunk(new Uint8Array(64), { durationMs: 10 });
    clearSttAudio();
    expect(getSttDiagnosticSnapshot().audioChunks).toHaveLength(0);
    addSttAudioChunk(new Uint8Array(64), { durationMs: 10 });
    setAudioRingEnabled(false);
    expect(getSttDiagnosticSnapshot().audioChunks).toHaveLength(0);
    expect(getSttDiagnosticSnapshot().recordingAudio).toBe(false);
  });

  it('creates playback object URLs from retained chunks', () => {
    const createObjectURL = jest.fn(() => 'blob:test-audio');
    const original = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    setAudioRingEnabled(true);
    const chunk = addSttAudioChunk(new Uint8Array([1, 2, 3]), { durationMs: 10 });
    expect(createSttAudioUrl(chunk)).toBe('blob:test-audio');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    URL.createObjectURL = original;
  });

  it('wipes transcript and audio evidence when the active call ends', () => {
    setSttDiagnosticSettings({ traceEnabled: true, audioRingEnabled: true });
    beginSttSession();
    recordSttEvent({ text: 'call evidence' });
    addSttAudioChunk(new Uint8Array([1, 2]), { durationMs: 100 });
    expect(getRetainedSttAudio()?.byteLength).toBe(2);
    endSttSession();
    expect(getSttDiagnosticSnapshot().events).toEqual([]);
    expect(getSttDiagnosticSnapshot().audioChunks).toEqual([]);
    expect(getRetainedSttAudio()).toBeNull();
  });

  it('uses the requested release version and clear APIs without persisted trace data', () => {
    expect(STT_DIAGNOSTIC_VERSION).toBe('4.148.0');
    setTraceEnabled(true);
    recordSttEvent({ text: 'clear me' });
    clearSttTraces();
    expect(getSttDiagnosticSnapshot().events).toHaveLength(0);
    setTraceEnabled(false);
    expect(recordSttEvent({ text: 'off' })).toBeNull();
  });
});
