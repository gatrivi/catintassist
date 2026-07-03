/**
 * Tests for exported audio editor core (spin-off pack).
 * Source: exports/audio-greeting-editor/src/audioEditorCore.js
 */

import {
  formatTime,
  buildEditorPeaks,
  detectSilences,
  spliceAudioBuffer,
  cropAudioBuffer,
  removeSilenceRegions,
} from '../../exports/audio-greeting-editor/src/audioEditorCore';

const mockCtx = {
  createBuffer: (channels, length, sampleRate) => {
    const data = new Float32Array(length);
    return {
      sampleRate,
      length,
      duration: length / sampleRate,
      numberOfChannels: channels,
      getChannelData: () => data,
    };
  },
};

const makeBuffer = (samples, sampleRate = 48000) => {
  const buf = mockCtx.createBuffer(1, samples.length, sampleRate);
  buf.getChannelData(0).set(samples);
  return buf;
};

describe('audioEditorCore export pack', () => {
  test('formatTime', () => {
    expect(formatTime(65.3)).toBe('1:05.3');
    expect(formatTime(0)).toBe('0:00.0');
  });

  test('buildEditorPeaks returns fixed width', () => {
    const channel = new Float32Array(1000).fill(0.5);
    const peaks = buildEditorPeaks(channel, 100);
    expect(peaks.length).toBe(100);
    expect(peaks[0]).toBe(0.5);
  });

  test('detectSilences finds quiet gap', () => {
    const sr = 48000;
    const samples = new Float32Array(sr * 2);
    samples.fill(0.5, 0, sr);
    samples.fill(0, sr, sr * 2);
    const buf = makeBuffer(samples, sr);
    const silences = detectSilences(buf, 0.05, 0.2);
    expect(silences.length).toBeGreaterThan(0);
    expect(silences[0].start).toBeGreaterThanOrEqual(0.9);
  });

  test('spliceAudioBuffer deletes region', () => {
    const sr = 48000;
    const samples = new Float32Array(sr).fill(0.1);
    const buf = makeBuffer(samples, sr);
    const result = spliceAudioBuffer(mockCtx, buf, null, 0.25, 0.75);
    expect(result.duration).toBeCloseTo(0.5, 1);
  });

  test('cropAudioBuffer keeps selection', () => {
    const sr = 48000;
    const buf = makeBuffer(new Float32Array(sr).fill(0.2), sr);
    const cropped = cropAudioBuffer(mockCtx, buf, 0.2, 0.8);
    expect(cropped.duration).toBeCloseTo(0.6, 1);
  });

  test('removeSilenceRegions shortens buffer', () => {
    const sr = 48000;
    const samples = new Float32Array(sr * 3);
    samples.fill(0.4, 0, sr);
    samples.fill(0, sr, sr * 2);
    samples.fill(0.4, sr * 2, sr * 3);
    const buf = makeBuffer(samples, sr);
    const silences = detectSilences(buf, 0.05, 0.2);
    const trimmed = removeSilenceRegions(mockCtx, buf, silences);
    expect(trimmed.duration).toBeLessThan(buf.duration);
  });
});
