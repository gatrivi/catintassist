/** Deepgram listen WS tuning — fast default for live interpret. v4.80.2 */

export const STT_LATENCY_STORAGE_KEY = 'catint_stt_latency_v1';
export const STT_LATENCY_CHANGED_EVENT = 'catint_stt_latency_changed';

export const STT_LATENCY_MODES = {
  fast: {
    id: 'fast',
    label: 'FAST',
    endpointing: 150,
    mediaRecorderMs: 100,
    interimProcessMs: 100,
    interimFlushMs: 100,
  },
  balanced: {
    id: 'balanced',
    label: 'BAL',
    endpointing: 300,
    mediaRecorderMs: 250,
    interimProcessMs: 200,
    interimFlushMs: 150,
  },
};

export const loadSttLatencyMode = () => {
  try {
    const raw = localStorage.getItem(STT_LATENCY_STORAGE_KEY);
    if (raw && STT_LATENCY_MODES[raw]) return raw;
  } catch (_) {}
  return 'fast';
};

export const saveSttLatencyMode = (mode) => {
  const next = STT_LATENCY_MODES[mode] ? mode : 'fast';
  try {
    localStorage.setItem(STT_LATENCY_STORAGE_KEY, next);
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STT_LATENCY_CHANGED_EVENT, { detail: next }));
  }
  return next;
};

export const getSttLatencyConfig = (mode = loadSttLatencyMode()) =>
  STT_LATENCY_MODES[mode] || STT_LATENCY_MODES.fast;

export const getMediaRecorderTimeslice = (mode) => getSttLatencyConfig(mode).mediaRecorderMs;
export const getInterimProcessThrottleMs = (mode) => getSttLatencyConfig(mode).interimProcessMs;
export const getInterimFlushMs = (mode) => getSttLatencyConfig(mode).interimFlushMs;

/** Documented Deepgram query params only. */
export const buildListenUrl = (lang, mode = loadSttLatencyMode()) => {
  const cfg = getSttLatencyConfig(mode);
  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    filler_words: 'true',
    words: 'true',
    language: lang,
    interim_results: 'true',
    endpointing: String(cfg.endpointing),
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
};

export const toggleSttLatencyMode = () => {
  const current = loadSttLatencyMode();
  const next = current === 'fast' ? 'balanced' : 'fast';
  return saveSttLatencyMode(next);
};
