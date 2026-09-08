// Hold auto-trigger / auto-resume rules (v4.89.1) — pure helpers, unit-tested.
// Click-outside-to-resume lives in App.js (study-hold-overlay onClick).
export const HOLD_INTENT_WINDOW_MS = 30000;
export const HOLD_SILENCE_TRIGGER_SECS = 3;
export const HOLD_RESUME_SPEECH_SECS = 2;

/** Auto-engage hold: a hold phrase was heard <30s ago and line went quiet (3s+). */
export const shouldAutoHold = ({ isHold, holdIntentAgeMs, silenceSecs }) =>
  !isHold && holdIntentAgeMs < HOLD_INTENT_WINDOW_MS && silenceSecs >= HOLD_SILENCE_TRIGGER_SECS;

/** Auto-resume: any speech while holding ends hold — the app transcribes, so speech = back. */
export const shouldAutoResume = ({ isHold, silenceSecs }) =>
  isHold && silenceSecs < HOLD_RESUME_SPEECH_SECS;
