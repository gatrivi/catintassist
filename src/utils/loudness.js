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

// ── Choppiness (v4.110.0) ────────────────────────────────────────────────
// "Broken up" garble signature: speech alternating in SHORT bursts and
// SHORT gaps (staccato). Normal word gaps are longer than CHOP_GAP_MAX_S,
// and stop consonants (t/p/k) make short gaps but sit inside LONG bursts —
// both are skipped, so normal speech stays SMOOTH.
const CHOP_FRAME_S = 0.03;      // 30ms analysis frames
const CHOP_BURST_MAX_S = 0.15;  // burst must be ≤ this to count as a fragment
const CHOP_GAP_MAX_S = 0.12;    // gap must be ≤ this to count as a dropout
const CHOP_CHOPPY_AT = 8;       // events per 10s of speech region
const CHOP_SLIGHT_AT = 3;

/** Pure tier mapping — same {label,color,width} shape as classifyLoudness. */
export const classifyChoppiness = (per10s) => {
  if (per10s === undefined || per10s === null || Number.isNaN(per10s)) {
    return { label: 'UNTESTED', color: '#94a3b8', width: '0%', per10s: null };
  }
  if (per10s >= CHOP_CHOPPY_AT) return { label: 'CHOPPY', color: '#fb923c', width: '25%', per10s };
  if (per10s >= CHOP_SLIGHT_AT) return { label: 'SLIGHT CHOP', color: '#fbbf24', width: '50%', per10s };
  return { label: 'SMOOTH', color: '#10b981', width: '100%', per10s };
};

/**
 * Pure: count stutter events (short burst followed by short gap) in the
 * clip's speech region, normalized per 10s. Thresholds are relative to the
 * clip's own peak so quiet clips are judged fairly.
 * @returns {{dropouts:number, per10s:number, activeSecs:number}}
 */
export const measureChoppiness = (channel, sampleRate = 48000) => {
  if (!channel || !channel.length) return { dropouts: 0, per10s: 0, activeSecs: 0 };
  const frameLen = Math.max(1, Math.round(sampleRate * CHOP_FRAME_S));
  let peak = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const a = Math.abs(channel[i]);
    if (a > peak) peak = a;
  }
  if (peak < 0.004) return { dropouts: 0, per10s: 0, activeSecs: 0 }; // silent — loudness covers it
  const threshold = peak * 0.05;
  const frames = [];
  for (let s = 0; s < channel.length; s += frameLen) {
    const end = Math.min(s + frameLen, channel.length);
    let sum = 0;
    for (let j = s; j < end; j += 1) sum += channel[j] * channel[j];
    frames.push(Math.sqrt(sum / (end - s)) > threshold);
  }
  const first = frames.indexOf(true);
  const last = frames.lastIndexOf(true);
  if (first < 0) return { dropouts: 0, per10s: 0, activeSecs: 0 };
  const maxBurst = Math.max(1, Math.round(CHOP_BURST_MAX_S / CHOP_FRAME_S));
  const maxGap = Math.max(1, Math.round(CHOP_GAP_MAX_S / CHOP_FRAME_S));
  let events = 0;
  let i = first;
  while (i <= last) {
    if (frames[i]) {
      let j = i;
      while (j <= last && frames[j]) j += 1;
      const burstLen = j - i;
      let k = j;
      while (k <= last && !frames[k]) k += 1;
      const gapLen = k - j;
      if (burstLen <= maxBurst && gapLen > 0 && gapLen <= maxGap) events += 1;
      i = j;
    } else {
      i += 1;
    }
  }
  const activeSecs = ((last - first + 1) * CHOP_FRAME_S);
  const per10s = activeSecs > 0 ? Math.round(((events / activeSecs) * 10) * 10) / 10 : 0;
  return { dropouts: events, per10s, activeSecs: Math.round(activeSecs * 10) / 10 };
};
