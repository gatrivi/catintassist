export const STT_DIAGNOSTIC_VERSION = '4.148.0';
export const TRACE_STORAGE_KEY = 'catint.sttDiagnostics.traceEnabled.v1';
export const AUDIO_RING_STORAGE_KEY = 'catint.sttDiagnostics.audioRingEnabled.v1';
export const STT_DIAGNOSTIC_SETTINGS_CHANGED_EVENT = 'catint-stt-diagnostic-settings-changed';
export const STT_DIAGNOSTIC_STATE_CHANGED_EVENT = 'catint-stt-diagnostic-state-changed';

export const STT_EVENT_STATUS = Object.freeze({
  RECEIVED: 'received',
  PROCESSED: 'processed',
  COMMITTED: 'committed',
  BLOCKED: 'blocked',
  THROTTLED: 'throttled',
  EMPTY: 'empty',
});

export const STT_TRACE_LIMITS = Object.freeze({
  maxEvents: 200,
  maxAudioDurationMs: 60000,
  maxAudioBytes: 5 * 1024 * 1024,
});

const readFlag = (key) => {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch (_) {
    return false;
  }
};

const writeFlag = (key, enabled) => {
  try {
    window.localStorage.setItem(key, enabled ? '1' : '0');
  } catch (_) {
    return;
  }
};

export const readSttDiagnosticSettings = () => ({
  traceEnabled: readFlag(TRACE_STORAGE_KEY),
  audioRingEnabled: readFlag(AUDIO_RING_STORAGE_KEY),
});

const notifySettingsChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent(STT_DIAGNOSTIC_SETTINGS_CHANGED_EVENT, {
      detail: readSttDiagnosticSettings(),
    }));
  } catch (_) {}
};

const state = {
  version: STT_DIAGNOSTIC_VERSION,
  sessionSequence: 0,
  eventSequence: 0,
  sessionId: null,
  events: [],
  audioChunks: [],
  audioBytes: 0,
  audioDurationMs: 0,
  recordingAudio: false,
};

const snapshot = () => ({
  version: state.version,
  sessionId: state.sessionId,
  events: state.events.map((event) => ({
    ...event,
    linkedCaptionIds: [...event.linkedCaptionIds],
  })),
  audioChunks: state.audioChunks.map((chunk) => ({ ...chunk })),
  audioBytes: state.audioBytes,
  audioDurationMs: state.audioDurationMs,
  recordingAudio: state.recordingAudio,
  settings: readSttDiagnosticSettings(),
});

const emitState = () => {
  try {
    window.dispatchEvent(new CustomEvent(STT_DIAGNOSTIC_STATE_CHANGED_EVENT, {
      detail: snapshot(),
    }));
  } catch (_) {}
};

export const getSttDiagnosticSnapshot = () => snapshot();
export const subscribeSttDiagnosticState = (listener) => {
  if (typeof listener !== 'function') return () => {};
  const handler = () => listener(snapshot());
  window.addEventListener(STT_DIAGNOSTIC_STATE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(STT_DIAGNOSTIC_STATE_CHANGED_EVENT, handler);
};

export const getActiveSttSessionId = () => state.sessionId;

export const beginSttSession = () => {
  state.sessionSequence += 1;
  state.eventSequence = 0;
  state.sessionId = `stt-${Date.now()}-${state.sessionSequence}`;
  state.events = [];
  state.audioChunks = [];
  state.audioBytes = 0;
  state.audioDurationMs = 0;
  state.recordingAudio = false;
  emitState();
  return state.sessionId;
};

export const endSttSession = () => {
  state.recordingAudio = false;
  state.sessionId = null;
  state.events = [];
  state.audioChunks = [];
  state.audioBytes = 0;
  state.audioDurationMs = 0;
  emitState();
};

const ensureSession = () => state.sessionId || beginSttSession();

const normalizeEvent = (details, status) => {
  const source = details || {};
  const receivedAt = source.wallClockMs ?? Date.now();
  return {
    id: `${ensureSession()}-event-${String(++state.eventSequence).padStart(6, '0')}`,
    sessionId: state.sessionId,
    status,
    rawText: String(source.text ?? source.rawText ?? ''),
    linkedCaptionIds: [],
    displayedCaptions: [],
    providerStart: source.providerStart ?? source.start ?? null,
    providerDuration: source.providerDuration ?? source.duration ?? null,
    wallClockMs: receivedAt,
    wallClockIso: new Date(receivedAt).toISOString(),
    lane: source.lane ?? null,
    socket: source.socket ?? source.socketId ?? null,
    confidence: source.confidence ?? null,
    final: source.final ?? source.isFinal ?? null,
    metadata: source.metadata && typeof source.metadata === 'object'
      ? { ...source.metadata }
      : {},
  };
};

export const recordSttEvent = (details = {}, status = STT_EVENT_STATUS.RECEIVED) => {
  if (!readSttDiagnosticSettings().traceEnabled) return null;
  const event = normalizeEvent(details, status);
  state.events.push(event);
  if (state.events.length > STT_TRACE_LIMITS.maxEvents) {
    state.events.splice(0, state.events.length - STT_TRACE_LIMITS.maxEvents);
  }
  emitState();
  return { ...event, linkedCaptionIds: [...event.linkedCaptionIds], displayedCaptions: event.displayedCaptions.map((item) => ({ ...item })) };
};

export const updateSttEvent = (eventId, patch = {}) => {
  if (!readSttDiagnosticSettings().traceEnabled) return null;
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return null;
  if (patch.status) event.status = patch.status;
  if (Object.prototype.hasOwnProperty.call(patch, 'rawText')) event.rawText = String(patch.rawText ?? '');
  if (Object.prototype.hasOwnProperty.call(patch, 'metadata')) {
    event.metadata = patch.metadata && typeof patch.metadata === 'object' ? { ...patch.metadata } : {};
  }
  emitState();
  return { ...event, linkedCaptionIds: [...event.linkedCaptionIds], displayedCaptions: event.displayedCaptions.map((item) => ({ ...item })) };
};

export const linkDisplayedCaption = (eventId, captionId, displayText) => {
  if (!readSttDiagnosticSettings().traceEnabled) return null;
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return null;
  const id = String(captionId);
  const text = String(displayText ?? '');
  const existing = event.displayedCaptions.find((caption) => caption.id === id);
  const linkedChanged = !event.linkedCaptionIds.includes(id);
  const textChanged = existing?.text !== text;
  if (linkedChanged) event.linkedCaptionIds.push(id);
  if (existing) existing.text = text;
  else event.displayedCaptions.push({ id, text });
  if (linkedChanged || textChanged) emitState();
  return { ...event, linkedCaptionIds: [...event.linkedCaptionIds], displayedCaptions: event.displayedCaptions.map((item) => ({ ...item })) };
};

const trimAudio = () => {
  while (state.audioChunks.length && (
    state.audioDurationMs > STT_TRACE_LIMITS.maxAudioDurationMs
    || state.audioBytes > STT_TRACE_LIMITS.maxAudioBytes
  )) {
    const removed = state.audioChunks.shift();
    state.audioDurationMs -= removed.durationMs;
    state.audioBytes -= removed.byteLength;
  }
};

const toBytes = (data) => {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  return null;
};

export const addSttAudioChunk = (data, { mimeType = 'audio/webm', durationMs = 0, wallClockMs = Date.now() } = {}) => {
  if (!readSttDiagnosticSettings().audioRingEnabled) return null;
  const bytes = toBytes(data);
  if (!bytes || bytes.byteLength === 0) return null;
  const duration = Math.max(0, Number(durationMs) || 0);
  if (bytes.byteLength > STT_TRACE_LIMITS.maxAudioBytes || duration > STT_TRACE_LIMITS.maxAudioDurationMs) return null;
  const chunk = {
    id: `${ensureSession()}-audio-${state.audioChunks.length + 1}-${wallClockMs}`,
    bytes: bytes.buffer,
    byteLength: bytes.byteLength,
    durationMs: duration,
    mimeType,
    wallClockMs,
  };
  state.audioChunks.push(chunk);
  state.audioBytes += bytes.byteLength;
  state.audioDurationMs += duration;
  trimAudio();
  emitState();
  return { ...chunk };
};

export const setSttAudioRecording = (recording) => {
  state.recordingAudio = Boolean(recording);
  emitState();
  return state.recordingAudio;
};

export const isSttAudioRecording = () => state.recordingAudio;

export const createSttAudioUrl = (chunk, AudioConstructor = window.Audio) => {
  if (!chunk?.bytes || typeof AudioConstructor !== 'function') return null;
  try {
    const blob = new Blob([chunk.bytes], { type: chunk.mimeType || 'audio/webm' });
    return URL.createObjectURL(blob);
  } catch (_) {
    return null;
  }
};

export const getRetainedSttAudio = () => {
  if (!state.audioChunks.length) return null;
  const bytes = new Uint8Array(state.audioBytes);
  let offset = 0;
  for (const chunk of state.audioChunks) {
    bytes.set(new Uint8Array(chunk.bytes), offset);
    offset += chunk.byteLength;
  }
  return {
    bytes: bytes.buffer,
    byteLength: bytes.byteLength,
    durationMs: state.audioDurationMs,
    mimeType: state.audioChunks[0].mimeType || 'audio/webm',
  };
};

export const clearSttAudio = () => {
  state.audioChunks = [];
  state.audioBytes = 0;
  state.audioDurationMs = 0;
  state.recordingAudio = false;
  emitState();
};

export const clearSttTraces = () => {
  state.events = [];
  state.eventSequence = 0;
  emitState();
};

export const wipeSttDiagnostics = () => {
  clearSttAudio();
  clearSttTraces();
};

export const setTraceEnabled = (enabled) => {
  writeFlag(TRACE_STORAGE_KEY, Boolean(enabled));
  if (!enabled) clearSttTraces();
  notifySettingsChanged();
  emitState();
};

export const setAudioRingEnabled = (enabled) => {
  writeFlag(AUDIO_RING_STORAGE_KEY, Boolean(enabled));
  if (!enabled) clearSttAudio();
  notifySettingsChanged();
  emitState();
};

export const setSttDiagnosticSettings = ({ traceEnabled, audioRingEnabled } = {}) => {
  const current = readSttDiagnosticSettings();
  const nextTrace = typeof traceEnabled === 'boolean' ? traceEnabled : current.traceEnabled;
  const nextAudio = typeof audioRingEnabled === 'boolean' ? audioRingEnabled : current.audioRingEnabled;
  writeFlag(TRACE_STORAGE_KEY, nextTrace);
  writeFlag(AUDIO_RING_STORAGE_KEY, nextAudio);
  if (!nextTrace) state.events = [];
  if (!nextAudio) {
    state.audioChunks = [];
    state.audioBytes = 0;
    state.audioDurationMs = 0;
    state.recordingAudio = false;
  }
  notifySettingsChanged();
  emitState();
  return { traceEnabled: nextTrace, audioRingEnabled: nextAudio };
};
