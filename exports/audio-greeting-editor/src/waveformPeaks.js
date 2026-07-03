/**
 * Peaks for list thumbnails vs full editor canvas.
 * From GreetingsPanel buildWaveformPeaks + AudioEditorPanel buildPeaks.
 */

import { buildEditorPeaks } from './audioEditorCore';

/** Normalized 0–1 peaks for ClipWaveform (default 56 bars). */
export async function buildWaveformPeaks(blob, bars = 56) {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const peaks = [];
    for (let i = 0; i < bars; i += 1) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channel.length);
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += Math.abs(channel[j]);
      peaks.push(sum / (end - start || 1));
    }
    const max = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / max);
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Float32 peaks for WaveformCanvas (default 680 bars). */
export async function buildEditorPeaksFromBlob(blob, width = 680) {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return buildEditorPeaks(audioBuffer.getChannelData(0), width);
  } finally {
    ctx.close().catch(() => {});
  }
}

export { buildEditorPeaks };
