// Hold auto-trigger / auto-resume rules (v4.147.0) — pure helpers, unit-tested.
// Click-outside-to-resume lives in App.js (study-hold-overlay onClick).
import { normalizeLang } from './languageConfig.js';

export const HOLD_INTENT_WINDOW_MS = 60000;
export const HOLD_SILENCE_TRIGGER_SECS = 30;
export const HOLD_RESUME_SPEECH_SECS = 2;

/** Auto-engage hold: a hold phrase was heard <60s ago and line went quiet (30s+). */
export const shouldAutoHold = ({ isHold, holdIntentAgeMs, silenceSecs }) =>
  !isHold && holdIntentAgeMs < HOLD_INTENT_WINDOW_MS && silenceSecs >= HOLD_SILENCE_TRIGGER_SECS;

/** Auto-resume: any speech while holding ends hold — the app transcribes, so speech = back. */
export const shouldAutoResume = ({ isHold, silenceSecs }) =>
  isHold && silenceSecs < HOLD_RESUME_SPEECH_SECS;

/**
 * v4.150.0: true ONLY for a full English sentence — EN lane + ≥4 words +
 * terminal punctuation (. ! ? …). Everything else (Spanish, fragments,
 * interims, background chatter about other patients) must NOT read as
 * "the doctor is back": the hold silence clock and the hold-intent disarm
 * both tick on this gate.
 */
export const isEnglishDoctorSentence = (lang, text) => {
  if (normalizeLang(lang) !== 'en') return false;
  const t = String(text || '').trim();
  if (!/[.!?…]["')\]]*$/.test(t)) return false;
  return t.split(/\s+/).filter(Boolean).length >= 4;
};
