/** Deepgram listen WS tuning — fast default for live interpret. v4.80.2 */
import { buildKeyterms } from './sttKeyterms';

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

/** Prefer webm/opus — Deepgram decode reliability (matches soundboard record path). */
export const getMediaRecorderOptions = () => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const opus = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
  if (MediaRecorder.isTypeSupported(opus.mimeType)) return opus;
  if (MediaRecorder.isTypeSupported('audio/webm')) return { mimeType: 'audio/webm' };
  return undefined;
};

/** Tab share includes video — STT must record audio-only webm, not video/webm. */
export const buildAudioOnlyStream = (stream) => {
  if (!stream || typeof MediaStream === 'undefined') return null;
  const tracks = stream.getAudioTracks();
  if (!tracks.length) return null;
  return new MediaStream(tracks);
};
export const getInterimProcessThrottleMs = (mode) => getSttLatencyConfig(mode).interimProcessMs;
export const getInterimFlushMs = (mode) => getSttLatencyConfig(mode).interimFlushMs;

/**
 * Provider biasing (v4.157.0) — OFF by default.
 *
 * Two switches, both opt-in because both change what the provider sends and
 * therefore what you pay:
 *   medicalModel  EN socket → `nova-3-medical` (EN only; the app is a two-lane
 *                 EN/ES structure, and ES stays nova-3-general). ~2x EN cost.
 *   keyterm       send the short domain list so the model hears drug names as
 *                 drug names. See utils/sttKeyterms.js for why the list is
 *                 short and where it comes from.
 *
 * The promise: with both off, `buildListenUrl` returns EXACTLY the URL it
 * returned in v4.154.0 — same string, byte for byte. That is a test.
 */
export const STT_BIAS_MEDICAL_MODEL = 'catint_stt_medical_model_v1';
export const STT_BIAS_KEYTERM = 'catint_stt_keyterm_v1';

const readFlag = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/** Read both bias switches at call time — a socket is built on CONNECT, so the
 *  value in effect at that moment is the one that matters. No re-render needed. */
export const readSttBias = () => ({
  medicalModel: readFlag(STT_BIAS_MEDICAL_MODEL),
  keyterm: readFlag(STT_BIAS_KEYTERM),
});

export const saveSttBias = (next = {}) => {
  try {
    localStorage.setItem(STT_BIAS_MEDICAL_MODEL, next.medicalModel ? '1' : '0');
    localStorage.setItem(STT_BIAS_KEYTERM, next.keyterm ? '1' : '0');
  } catch {
    /* private mode: the session simply runs unbiased */
  }
  return readSttBias();
};

/**
 * Phone-interpret: general Nova-3 is the safe default.
 * "Medical + filler_words is unsupported and can kill the EN socket" — that
 * comment blames filler_words, not the medical model, and it was never tested
 * (see docs/stt-eval-plan.md §Stage 3). So the medical model is opt-in and the
 * caller decides.
 */
export const getDeepgramModel = (lang, { medicalModel = false } = {}) => {
  if (medicalModel && langCode(lang) === 'en') return 'nova-3-medical';
  return 'nova-3-general';
};

const langCode = (l) => (l || 'en').toString().toLowerCase().slice(0, 2);

/** Documented Deepgram query params only. */
export const buildListenUrl = (lang, mode = loadSttLatencyMode(), bias = {}) => {
  const { medicalModel = false, keyterm = false } = bias || {};
  const cfg = getSttLatencyConfig(mode);
  const params = new URLSearchParams({
    model: getDeepgramModel(lang, { medicalModel }),
    smart_format: 'true',
    numerals: 'true',
    filler_words: 'true',
    words: 'true',
    language: lang,
    interim_results: 'true',
    endpointing: String(cfg.endpointing),
  });
  // Appended last, and only when asked for: with the switch off the query string
  // is exactly what it has always been.
  if (keyterm) {
    buildKeyterms(lang).forEach((term) => params.append('keyterm', term));
  }
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
};

export const toggleSttLatencyMode = () => {
  const current = loadSttLatencyMode();
  const next = current === 'fast' ? 'balanced' : 'fast';
  return saveSttLatencyMode(next);
};
