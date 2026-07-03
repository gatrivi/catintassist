/** Clip playback via passthrough element — same VB-Cable path as live mic (v4.75.0). */

export const ROUTE_MODE = {
  PASSTHROUGH: 'passthrough',
  DUAL_ELEMENT: 'dual_element',
};

const RAMP_MS = 50;

export function readRouteModePreference() {
  try {
    const v = localStorage.getItem('CATINT_ROUTE_MODE');
    return v === ROUTE_MODE.DUAL_ELEMENT ? ROUTE_MODE.DUAL_ELEMENT : ROUTE_MODE.PASSTHROUGH;
  } catch {
    return ROUTE_MODE.PASSTHROUGH;
  }
}

export function writeRouteModePreference(mode) {
  try {
    localStorage.setItem('CATINT_ROUTE_MODE', mode);
  } catch (_) {}
}

/**
 * Decode blob to AudioBuffer. Caller must close ctx when done.
 * @param {Blob} blob
 * @param {typeof AudioContext} [AudioContextCtor]
 */
export async function decodeBlobToBuffer(blob, AudioContextCtor = window.AudioContext || window.webkitAudioContext) {
  if (!AudioContextCtor) throw new Error('AudioContext unavailable');
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContextCtor();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  return { ctx, buffer };
}

/**
 * Play buffer through passthrough element (replaces srcObject; restores on end).
 * @returns {{ promise: Promise<void>, stop: () => void, duration: number }}
 */
export function playBufferViaPassthrough(passthroughEl, buffer, ctx, {
  volume = 1,
  sinkId,
  savedSrcObject = null,
  onProgress,
}) {
  if (!passthroughEl || !buffer || !ctx) {
    return { promise: Promise.reject(new Error('missing passthrough args')), stop: () => {}, duration: 0 };
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
  const dest = ctx.createMediaStreamDestination();
  source.connect(gain);
  gain.connect(dest);

  const finish = (err) => {
    if (stopped) return;
    stopped = true;
    try {
      source.stop();
    } catch (_) {}
    try {
      gain.gain.setValueAtTime(0, ctx.currentTime);
    } catch (_) {}
    passthroughEl.srcObject = savedSrcObject;
    passthroughEl.pause?.();
    ctx.close().catch(() => {});
    if (err) rejectEnd(err);
    else resolveEnd();
  };

  const stop = () => finish();

  const bindAndPlay = async () => {
    try {
      if (sinkId && passthroughEl.setSinkId) {
        await passthroughEl.setSinkId(sinkId);
      }
      passthroughEl.srcObject = dest.stream;
      passthroughEl.volume = 1;
      passthroughEl.muted = false;
      await passthroughEl.play().catch(() => {});

      const now = ctx.currentTime;
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

  bindAndPlay();

  return { promise, stop, duration: buffer.duration };
}

/**
 * High-level: blob → passthrough injection.
 */
export async function playBlobViaPassthrough(passthroughEl, blob, opts = {}) {
  const { ctx, buffer } = await decodeBlobToBuffer(blob);
  const session = playBufferViaPassthrough(passthroughEl, buffer, ctx, opts);
  await session.promise;
  return { mode: ROUTE_MODE.PASSTHROUGH, duration: session.duration };
}
