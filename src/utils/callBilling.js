/**
 * Pure call-billing rule (v4.99.2) — no React/storage imports.
 *
 * Speech calls bill talk time minus trailing silence (>30s).
 * v4.99.2: a call with NO STT speech that ran ≥60s bills wall-clock —
 * a Deepgram outage must not erase a worked day (the "156m month" bug).
 */
export const NO_STT_MIN_CALL_SECS = 60;

export const billableSecondsForCall = ({
  hadSpeech,
  sessionSeconds = 0,
  trailingSilenceSecs = 0,
}) => {
  if (!hadSpeech) {
    return sessionSeconds >= NO_STT_MIN_CALL_SECS ? sessionSeconds : 0;
  }
  return trailingSilenceSecs > 30
    ? Math.max(0, sessionSeconds - trailingSilenceSecs)
    : sessionSeconds;
};
