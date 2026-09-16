// Ring signature (v4.104.0 "robot mode") — learn the platform's ring sound
// from the preserved cable/tab stream so an incoming call can auto-start the
// call BEFORE speech arrives (VAD alone wakes on any loud audio; this wakes
// on the ring's specific tones). Pure functions + localStorage.

export const RING_SIGNATURE_KEY = "catint_ring_signature_v1";

/** Consecutive matching 100ms frames (~500ms of ring) before auto-start. */
export const RING_TRIGGER_FRAMES = 5;

/** Events between Settings (button) and useDeepgram (owns the stream). */
export const RING_LEARN_EVENT = "catint_ring_learn_start";
export const RING_SIG_CHANGED_EVENT = "catint_ring_signature_changed";

/** Byte-FFT peak extraction band + magnitude floor (0-255 scale). */
const MIN_HZ = 120;
const MAX_HZ = 4000;
const MIN_BIN_MAG = 100;

/**
 * One byte-FFT frame → top-N dominant frequencies (Hz), quietest dropped.
 * Local peak required (bin taller than both neighbours) so a shoulder bin of
 * the same tone isn't counted twice.
 */
export const extractPeakHz = (bytes, sampleRate = 48000, { topN = 3 } = {}) => {
  if (!bytes || bytes.length < 3) return [];
  const binHz = sampleRate / 2 / bytes.length;
  const minIdx = Math.max(1, Math.floor(MIN_HZ / binHz));
  const maxIdx = Math.min(bytes.length - 2, Math.ceil(MAX_HZ / binHz));
  const peaks = [];
  for (let i = minIdx; i <= maxIdx; i++) {
    if (
      bytes[i] >= MIN_BIN_MAG &&
      bytes[i] >= bytes[i - 1] &&
      bytes[i] >= bytes[i + 1]
    ) {
      peaks.push({ hz: i * binHz, mag: bytes[i] });
    }
  }
  return peaks
    .sort((a, b) => b.mag - a.mag)
    .slice(0, topN)
    .map((p) => Math.round(p.hz));
};

/**
 * frames: array of Hz arrays from extractPeakHz while the ring was playing.
 * Signature = the frequencies that recur in most frames (bucketed at 40Hz),
 * sorted by how often they appeared. Empty when too few samples → no learn.
 */
export const buildRingSignature = (frames, { minFrames = 6, quorum = 0.6 } = {}) => {
  const usable = (frames || []).filter((f) => f && f.length > 0);
  if (usable.length < minFrames) return null;
  const buckets = {};
  usable.forEach((peaks) => {
    peaks.forEach((hz) => {
      const key = Math.round(hz / 40) * 40;
      (buckets[key] = buckets[key] || []).push(hz);
    });
  });
  const sigPeaks = Object.entries(buckets)
    .filter(([, hzs]) => hzs.length / usable.length >= quorum)
    .map(([, hzs]) => Math.round(hzs.reduce((a, b) => a + b, 0) / hzs.length))
    .sort((a, b) => a - b);
  return sigPeaks.length > 0 ? { peaks: sigPeaks, at: Date.now() } : null;
};

/** Every learned tone must be present in this frame's peaks (+/-tolerance).
 * Tolerance auto-clamps below half the smallest gap between learned tones:
 * buildRingSignature buckets at 40Hz, so two tones can sit 40Hz apart - a
 * flat 45Hz tolerance would let one peak match both and never miss a tone. */
export const matchRingSignature = (sig, peaks, tolHz = 45) => {
  if (!sig?.peaks?.length || !peaks?.length) return false;
  const sorted = [...sig.peaks].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  }
  const tol = Math.min(tolHz, Math.max(0, Math.floor(minGap / 2) - 1));
  return sorted.every(
    (hz) => peaks.some((p) => Math.abs(p - hz) <= tol),
  );
};

export const loadRingSignature = () => {
  try {
    const raw = localStorage.getItem(RING_SIGNATURE_KEY);
    const sig = raw ? JSON.parse(raw) : null;
    return sig?.peaks?.length ? sig : null;
  } catch (_) {
    return null;
  }
};

export const saveRingSignature = (sig) => {
  try {
    localStorage.setItem(RING_SIGNATURE_KEY, JSON.stringify(sig));
    window.dispatchEvent(new CustomEvent(RING_SIG_CHANGED_EVENT, { detail: sig }));
  } catch (_) {}
};

export const clearRingSignature = () => {
  try {
    localStorage.removeItem(RING_SIGNATURE_KEY);
    window.dispatchEvent(new CustomEvent(RING_SIG_CHANGED_EVENT, { detail: null }));
  } catch (_) {}
};
