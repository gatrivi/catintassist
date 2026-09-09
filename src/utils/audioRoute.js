/** Best-effort HTMLAudioElement → virtual output (VB-Cable etc.) */

export async function bindAudioToSink(audioEl, sinkId) {
  if (!audioEl?.setSinkId || !sinkId) return false;
  try {
    await audioEl.setSinkId(sinkId);
    return true;
  } catch (err) {
    console.error('bindAudioToSink failed:', err);
    return false;
  }
}

export function primePlaybackElements(localEl, sinkEl) {
  if (localEl) {
    localEl.preload = 'auto';
    localEl.volume = 0;
  }
  if (sinkEl) {
    sinkEl.preload = 'auto';
    sinkEl.volume = 0;
  }
}

/**
 * Ramp 0→target over ~50ms to avoid pops.
 * v4.95.0: interval ticks throttle to ≥1s when the tab is hidden (interpreter
 * focuses the call app) — the clip played at near-zero volume. Guard with wall
 * time: if ticks fall behind, jump straight to the final volume. A tiny pop
 * beats an inaudible greeting.
 */
export function rampVolume(localEl, sinkEl, localTarget, sinkTarget, onDone) {
  const RAMP_MS = 50;
  const t0 = Date.now();
  const done = () => {
    if (localEl) localEl.volume = localTarget;
    if (sinkEl) sinkEl.volume = sinkTarget;
    onDone?.();
  };
  // Hidden tab: intervals won't tick — set final volume now.
  if (typeof document !== 'undefined' && document.hidden) {
    done();
    return () => {};
  }
  let vol = 0;
  const tick = setInterval(() => {
    if (Date.now() - t0 > RAMP_MS * 3) {
      clearInterval(tick);
      done();
      return;
    }
    vol += 0.1;
    if (vol >= 1) {
      clearInterval(tick);
      done();
    } else {
      if (localEl) localEl.volume = vol * localTarget;
      if (sinkEl) sinkEl.volume = vol * sinkTarget;
    }
  }, 10);
  return () => clearInterval(tick);
}
