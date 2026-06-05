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

/** Ramp 0→target over ~50ms to avoid pops */
export function rampVolume(localEl, sinkEl, localTarget, sinkTarget, onDone) {
  let vol = 0;
  const tick = setInterval(() => {
    vol += 0.1;
    if (vol >= 1) {
      if (localEl) localEl.volume = localTarget;
      if (sinkEl) sinkEl.volume = sinkTarget;
      clearInterval(tick);
      onDone?.();
    } else {
      if (localEl) localEl.volume = vol * localTarget;
      if (sinkEl) sinkEl.volume = vol * sinkTarget;
    }
  }, 10);
  return () => clearInterval(tick);
}
