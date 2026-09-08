// Auto-break rules (v4.90.0) — pure helpers, unit-tested.
// Rule: break counts EVERY second with no transcription detected, unless
// hold (provider keywords: "one moment", "please hold", …) is active.

/** No transcription for ≥3s and not on hold → break time. */
export const BREAK_SILENCE_GRACE_SECS = 3;

/** A break stint this long counts as a real break (resets the "working
 *  without break" nudge). Short mid-call dead-air gaps do not. */
export const LONG_BREAK_STINT_SECS = 300;

/** After STOP BREAK, suppress auto-break this long (desk work grace). */
export const MANUAL_BREAK_SUPPRESS_MS = 10 * 60 * 1000;

export const shouldAutoBreak = ({ isHold, silenceSecs }) =>
  !isHold && silenceSecs >= BREAK_SILENCE_GRACE_SECS;

/** Long-enough break stint → restart the "minutes working without break" clock. */
export const shouldResetWorkTimer = (stintSecs) => stintSecs >= LONG_BREAK_STINT_SECS;
