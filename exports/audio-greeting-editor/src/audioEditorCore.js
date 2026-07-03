/**
 * Pure audio editor utilities (no React).
 * Extracted from CatIntAssist AudioEditorPanel.js — v4.77.0
 */

export function formatTime(sec) {
  if (!sec && sec !== 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

/** Peak array for editor canvas (default 680 bars, max amplitude per bucket). */
export function buildEditorPeaks(channelData, width = 680) {
  const blockSize = Math.floor(channelData.length / width);
  const peaks = new Float32Array(width);
  for (let i = 0; i < width; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

/**
 * RMS-based silence regions.
 * @returns {Array<{ start: number, end: number }>} seconds
 */
export function detectSilences(audioBuffer, threshold = 0.015, minDuration = 0.25) {
  const data = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const windowSize = Math.floor(sr * 0.02);
  const silences = [];
  let silStart = null;
  for (let i = 0; i < data.length; i += windowSize) {
    const slice = data.slice(i, i + windowSize);
    const rms = Math.sqrt(slice.reduce((acc, v) => acc + v * v, 0) / slice.length);
    const timeSec = i / sr;
    if (rms < threshold) {
      if (silStart === null) silStart = timeSec;
    } else if (silStart !== null) {
      const dur = timeSec - silStart;
      if (dur >= minDuration) silences.push({ start: silStart, end: timeSec });
      silStart = null;
    }
  }
  if (silStart !== null) {
    const dur = audioBuffer.duration - silStart;
    if (dur >= minDuration) silences.push({ start: silStart, end: audioBuffer.duration });
  }
  return silences;
}

/** Replace [startSec, endSec) with replacement buffer, or delete if replacement is null. */
export function spliceAudioBuffer(ctx, original, replacement, startSec, endSec) {
  const sr = original.sampleRate;
  const startSample = Math.floor(startSec * sr);
  const endSample = Math.floor(endSec * sr);
  const beforeLength = startSample;
  const repLength = replacement ? replacement.length : 0;
  const afterLength = original.length - endSample;
  const newLength = beforeLength + repLength + afterLength;
  const result = ctx.createBuffer(1, newLength, sr);
  const out = result.getChannelData(0);
  out.set(original.getChannelData(0).slice(0, startSample), 0);
  if (replacement) out.set(replacement.getChannelData(0), startSample);
  out.set(original.getChannelData(0).slice(endSample), startSample + repLength);
  return result;
}

export function pcmToWavBlob(audioBuffer) {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function audioBufferToBlob(audioBuffer) {
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return pcmToWavBlob(rendered);
}

export async function decodeBlobToAudioBuffer(blob, audioCtx) {
  const arrayBuf = await blob.arrayBuffer();
  return audioCtx.decodeAudioData(arrayBuf);
}

/** Crop buffer to [startSec, endSec). */
export function cropAudioBuffer(ctx, audioBuffer, startSec, endSec) {
  const s = Math.min(startSec, endSec);
  const e = Math.max(startSec, endSec);
  const sr = audioBuffer.sampleRate;
  const startSample = Math.floor(s * sr);
  const endSample = Math.floor(e * sr);
  const cropped = ctx.createBuffer(1, endSample - startSample, sr);
  cropped.getChannelData(0).set(audioBuffer.getChannelData(0).slice(startSample, endSample));
  return cropped;
}

/** Remove all silence regions (reverse order so indices stay valid). */
export function removeSilenceRegions(ctx, audioBuffer, silences) {
  let buf = audioBuffer;
  const sorted = [...silences].sort((a, b) => b.start - a.start);
  for (const s of sorted) {
    buf = spliceAudioBuffer(ctx, buf, null, s.start, s.end);
  }
  return buf;
}
