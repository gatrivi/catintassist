// Tone watch (v4.98.0) — EXPERIMENTAL, log-only for now.
// Listens to the preserved platform-audio stream and records narrow-band
// energy bursts (the ring / end-bell look like concentrated tones; speech is
// broadband). Nothing acts on this yet: Settings shows what it hears so we can
// tune thresholds against the real platform sounds before enabling actions.

/** How concentrated the energy must be to count as a "tone" frame. Speech sits far below. */
export const TONE_CONCENTRATION_MIN = 6;
/** Mean bin magnitude (0..1) floor — skip silence. */
export const TONE_LEVEL_MIN = 0.02;

/**
 * One FFT frame → { level, peakHz, concentration }.
 * concentration = peak bin / mean bin. A pure tone ≫ 1; speech hovers low.
 */
export const analyzeToneFrame = (bytes, sampleRate = 48000) => {
  if (!bytes || bytes.length === 0) return { level: 0, peakHz: 0, concentration: 0 };
  let total = 0;
  let peakIdx = 0;
  for (let i = 0; i < bytes.length; i++) {
    total += bytes[i];
    if (bytes[i] > bytes[peakIdx]) peakIdx = i;
  }
  const mean = total / bytes.length;
  const binHz = sampleRate / 2 / bytes.length;
  return {
    level: level01(total, bytes.length),
    peakHz: Math.round(peakIdx * binHz),
    concentration: mean > 0 ? bytes[peakIdx] / mean : 0,
  };
};

const level01 = (total, n) => total / (n * 255);

/** Rolling 60s tone-frame tracker with a small human-readable event log. */
export const createToneTracker = ({ windowMs = 60000, maxLog = 40 } = {}) => {
  let frames = []; // { at, peakHz, level, concentration }
  const log = [];
  return {
    /** Record one analyzed frame (call every ~200ms while listening). */
    push(frame, now = Date.now()) {
      if (!frame || frame.level < TONE_LEVEL_MIN || frame.concentration < TONE_CONCENTRATION_MIN) return;
      frames.push({ at: now, peakHz: frame.peakHz, level: frame.level, concentration: frame.concentration });
      log.unshift(`${new Date(now).toLocaleTimeString()} · ~${frame.peakHz}Hz · x${frame.concentration.toFixed(1)}`);
      if (log.length > maxLog) log.pop();
    },
    /** What Settings displays + what we'd tune thresholds against. */
    summary(now = Date.now()) {
      frames = frames.filter((f) => now - f.at <= windowMs);
      const hzBuckets = {};
      frames.forEach((f) => {
        const key = Math.round(f.peakHz / 50) * 50;
        hzBuckets[key] = (hzBuckets[key] || 0) + 1;
      });
      const dominant = Object.entries(hzBuckets).sort((a, b) => b[1] - a[1])[0];
      return {
        toneFrames: frames.length,
        dominantHz: dominant ? Number(dominant[0]) : 0,
        log: log.slice(),
      };
    },
  };
};
