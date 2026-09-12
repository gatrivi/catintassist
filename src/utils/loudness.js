/**
 * v4.109.0 — local loudness eval for soundboard clips (no API call, no key).
 *
 * Playback peak-normalizes to −1 dBFS (audioRoutePassthrough), but a quiet
 * recording's noise floor gets amplified together with the voice — that is
 * the "sounds fine to me, garble to the patient" trap. So "loud enough to be
 * heard clearly" is judged on the recording's own speech level (RMS) BEFORE
 * that boost.
 *
 * Tiers reuse the classifyHealthScore shape {label,color,width} so the
 * existing .sb-health-pill CSS renders them unchanged.
 */

// Speech recorded at a sane mic distance lands around −20..−12 dBFS RMS.
export const classifyLoudness = (rmsDb, peakDb) => {
  if (rmsDb === undefined || rmsDb === null || Number.isNaN(rmsDb)) {
    return { label: 'UNTESTED', color: '#94a3b8', width: '0%', rmsDb: null, peakDb: null };
  }
  // Near-zero waveform: decode failed or the clip is truly empty.
  if (peakDb !== undefined && peakDb !== null && peakDb < -45) {
    return { label: 'SILENT', color: '#fb923c', width: '25%', rmsDb, peakDb };
  }
  if (rmsDb >= -17) return { label: 'PEACHES', color: '#10b981', width: '100%', rmsDb, peakDb };
  if (rmsDb >= -23) return { label: 'GOOD', color: '#34d399', width: '75%', rmsDb, peakDb };
  if (rmsDb >= -30) return { label: 'SOFT', color: '#fbbf24', width: '50%', rmsDb, peakDb };
  return { label: 'TOO QUIET', color: '#fb923c', width: '25%', rmsDb, peakDb };
};

/** Pure: RMS + peak in dBFS from one channel of decoded audio (Float32Array). */
export const measureChannelLoudness = (channel) => {
  if (!channel || !channel.length) return { rmsDb: -Infinity, peakDb: -Infinity };
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const v = channel[i];
    sumSquares += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSquares / channel.length);
  return {
    rmsDb: Math.round(20 * Math.log10(rms || 1e-9) * 10) / 10,
    peakDb: Math.round(20 * Math.log10(peak || 1e-9) * 10) / 10,
  };
};

/** Decode a stored clip blob and return {rmsDb, peakDb, label, color, width}. */
export const analyzeBlobLoudness = async (blob) => {
  if (!blob) return null;
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const m = measureChannelLoudness(audioBuffer.getChannelData(0));
    return { ...classifyLoudness(m.rmsDb, m.peakDb) };
  } finally {
    ctx.close().catch(() => {});
  }
};
