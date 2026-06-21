/** Shared off-call status / idle tips — one source for sticky bar + scoreboard cue. */

export const IDLE_TIP_LEVEL_KEY = 'catint_idle_tip_level_v1';
export const IDLE_TIP_SNOOZE_UNTIL_KEY = 'catint_idle_tip_snoozed_until_v1';

export const OFF_CALL_ADVICE = [
  'Tip: Press C or CONNECT to attach, then CALL START when the patient connects.',
  'Tip: Press M or use the mic button for mic mode if tab audio is unavailable.',
  'Tip: Double-tap CONNECT to re-open the browser tab picker (Chrome preferred).',
  'Tip: Pin key details so numbers stay visible while you wait.',
  'Tip: Settings → Language to change transcription pair (default EN↔ES).',
  'Tip: Space / Alt+Space force left/right STT lane (30s) — pair in Settings → Language.',
  'Tip: Open Help (?) for the bilingual guided tour.',
];

export const IDLE_TIPS = [
  'At 9am the app auto-attaches your interpreting tab when Auto-attach is on — watch the status bar.',
  'Press C or CONNECT to attach; press again (CALL START) when the patient connects.',
  'Press M or the mic button to use your device microphone instead of tab audio.',
  'Double-tap CONNECT to re-open the browser tab picker (Chrome preferred).',
  'Use Space/Alt+Space to toggle EN/ES detection while you wait.',
  'Pin key details so voicemail numbers stay visible.',
  'Soundboard Studio (pyramid switch) — record greetings off-call only.',
];

export const IDLE_CHECKLIST = [
  'CONNECT tab · CALL START when patient is on · STOP when done',
  'Status bar alternates connect vs mic tips until audio is attached.',
  'After attach: status says CALL START — timer begins only then.',
];

export const readIdleTipPrefs = () => {
  try {
    const level = localStorage.getItem(IDLE_TIP_LEVEL_KEY) || 'normal';
    const snoozedUntil = Number(localStorage.getItem(IDLE_TIP_SNOOZE_UNTIL_KEY) || '0');
    return { level, snoozedUntil };
  } catch {
    return { level: 'normal', snoozedUntil: 0 };
  }
};

export const isIdleTipsMuted = (prefs = readIdleTipPrefs()) =>
  prefs.level === 'less' || prefs.snoozedUntil > Date.now();

export const pickRotatingAdvice = (now = Date.now()) =>
  OFF_CALL_ADVICE[Math.floor(now / 12000) % OFF_CALL_ADVICE.length];
