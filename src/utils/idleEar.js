// Idle-ear rules (v4.92.0) — pure helpers, unit-tested.
// Between calls the Deepgram sockets stay warm (KeepAlive pings only — ZERO
// audio sent, so zero Deepgram usage) and a local VAD on the preserved
// tab/cable stream wakes the recorder when speech appears → transcript →
// speech auto-connect starts the call by itself.

/** RMS above this counts as "loud" (speech energy vs silence/hiss). */
export const IDLE_EAR_RMS_THRESHOLD = 0.02;

/** Consecutive loud 100ms frames needed before waking (~300ms of speech). */
export const IDLE_EAR_TRIGGER_FRAMES = 3;

export const updateVadLoudFrames = ({ rms, prevLoudFrames }) =>
  rms >= IDLE_EAR_RMS_THRESHOLD ? prevLoudFrames + 1 : 0;

export const shouldWakeFromVad = (loudFrames) =>
  loudFrames >= IDLE_EAR_TRIGGER_FRAMES;
