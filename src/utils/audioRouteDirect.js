/** Direct sink clip playback via AudioContext.setSinkId (v4.104.0).
 *
 *  v4.104.0: the caller route sounded "can of tuna" because playBufferViaPassthrough
 *  rendered the clip as a LIVE MediaStream into the shared mic element (srcObject
 *  swap). Live streams have no buffer and drift against the cable device clock.
 *  Here we render straight into the sink device: BufferSource → Gain → ctx.destination,
 *  with one persistent 48 kHz AudioContext per sinkId (no per-clip churn, no element
 *  swap, mic untouched).
 *
 *  Fallback chain stays: direct → passthrough (audioRoutePassthrough) → dual_element.
 */

import { normalizePeak } from './audioRoutePassthrough';

const RAMP_MS = 50;

// One persistent 48k context per sink — setSinkId migrates the render device,
// so reuse avoids per-clip device open/close clicks.
const ctxBySink = new Map();

/** Feature-detect: Chrome/Edge 110+ implement AudioContext.setSinkId. */
export function isDirectSinkSupported() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  return !!(Ctor && typeof Ctor.prototype?.setSinkId === 'function');
}

/**
 * Persistent context for a sink. Throws when unsupported so the caller can
 * fall back to the passthrough path.
 */
export function getDirectSinkContext(sinkId) {
  if (!isDirectSinkSupported()) {
    throw new Error('direct_sink_unsupported');
  }
  const key = sinkId || 'default';
  let ctx = ctxBySink.get(key);
  if (!ctx || ctx.state === 'closed') {
    // 48 kHz: matches Voicemeeter / CABLE endpoints (see micVerify guidance).
    ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    ctxBySink.set(key, ctx);
  }
  return ctx;
}

/** Test/cleanup helper: close every persistent context. */
export function closeDirectContexts() {
  for (const [key, ctx] of ctxBySink) {
    ctx.close().catch(() => {});
    ctxBySink.delete(key);
  }
}

/** blob.arrayBuffer() is missing on older engines/jsdom — FileReader covers it. */
const blobToArrayBuffer = (blob) =>
  blob.arrayBuffer
    ? blob.arrayBuffer()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });

/** Decode on the given (persistent) context — decodeAudioData resamples to ctx rate. */
export async function decodeBlobOnContext(ctx, blob) {
  const arrayBuffer = await blobToArrayBuffer(blob);
  return ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Play a decoded buffer directly into the context's sink (setSinkId must already
 * have been applied — see playBlobToSinkDirect).
 * @returns {{ promise: Promise<void>, stop: () => void, duration: number }}
 */
export function playBufferDirect(ctx, buffer, {
  volume = 1,
  onProgress,
  normalize = true,
} = {}) {
  if (!ctx || !buffer) {
    return { promise: Promise.reject(new Error('missing direct args')), stop: () => {}, duration: 0 };
  }

  let stopped = false;
  let resolveEnd;
  let rejectEnd;
  const promise = new Promise((res, rej) => {
    resolveEnd = res;
    rejectEnd = rej;
  });

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(ctx.destination);

  const finish = (err) => {
    if (stopped) return;
    stopped = true;
    try {
      source.stop();
    } catch (_) {}
    try {
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.disconnect();
    } catch (_) {}
    if (err) rejectEnd(err);
    else resolveEnd();
  };

  const stop = () => finish();

  const start = () => {
    try {
      if (normalize) normalizePeak(buffer);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + RAMP_MS / 1000);
      source.start(0);

      const duration = buffer.duration;
      let progId = null;
      if (onProgress) {
        const t0 = performance.now();
        const tick = () => {
          if (stopped) return;
          const p = Math.min(1, (performance.now() - t0) / 1000 / duration);
          onProgress(p);
          if (p < 1) progId = requestAnimationFrame(tick);
        };
        progId = requestAnimationFrame(tick);
      }

      source.onended = () => {
        if (progId) cancelAnimationFrame(progId);
        onProgress?.(1);
        finish();
      };
    } catch (e) {
      finish(e);
    }
  };

  start();

  return { promise, stop, duration: buffer.duration };
}

/**
 * High-level: blob → direct sink render. Resumes ctx (user-gesture play),
 * applies setSinkId, then plays.
 * @returns {Promise<{ promise: Promise<void>, stop: () => void, duration: number }>}
 */
export async function playBlobToSinkDirect(blob, sinkId, opts = {}) {
  const ctx = getDirectSinkContext(sinkId);
  await ctx.resume();
  await ctx.setSinkId(sinkId || '');
  const buffer = await decodeBlobOnContext(ctx, blob);
  return playBufferDirect(ctx, buffer, opts);
}
