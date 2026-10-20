/**
 * v4.190.0 greeting press feedback — a press is never silent.
 *
 * Every press on the on-call strip walks through visible phases:
 *   sending  amber  "SENDING · ES opener"         pressed, audio not heard yet
 *   onair    green  "ON AIR · ES opener ▮▮▮▯▯"    output meter shows real sound
 *   sent     green  "SENT ✓ 3.2s"                 finished, sound was measured
 *   failed   red    "NOT SENT · <reason>"         stays until tapped
 *
 * Pure helpers only; the strip owns the state.
 */

/** RMS above this on the output tap = sound reached the device. */
export const HEARD_RMS = 0.005;
/** No sound this long after the press = the patient hears nothing. */
export const SILENT_AFTER_MS = 1500;

/** 0–5 meter bars from an output RMS (normalised speech sits ~0.05–0.2). */
export const levelBars = (rms) => Math.max(0, Math.min(5, Math.ceil((rms || 0) * 25)));

/** Plain-words reason for a playback error — what to do, not a stack trace. */
export function failReason(err) {
  const name = err?.name || '';
  const msg = String(err?.message || err || '');
  if (name === 'NotAllowedError' || /not allowed|user gesture|autoplay/i.test(msg)) {
    return 'browser blocked audio — click the page once, then press again';
  }
  if (name === 'NotFoundError' || /sink|device|not found/i.test(msg)) {
    return 'output device missing — re-pick Speaker (CABLE Input)';
  }
  if (/decode|encoding|format/i.test(msg)) {
    return 'recording is unreadable — re-record it off-call';
  }
  return msg ? `playback error: ${msg}` : 'playback error';
}

/**
 * Final phase when a clip ends.
 * @param {boolean} levelKnown  the output meter reported at least once
 * @param {boolean} heard       the meter crossed HEARD_RMS at least once
 * @param {number} secs         how long it played
 */
export function finishPhase({ levelKnown, heard, secs }) {
  if (levelKnown && !heard) {
    return { phase: 'failed', text: 'SILENT — no sound reached the output' };
  }
  return {
    phase: 'sent',
    text: `SENT ✓ ${secs.toFixed(1)}s${levelKnown ? '' : ' (not measured)'}`,
  };
}
