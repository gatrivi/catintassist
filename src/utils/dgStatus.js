// Deepgram health truth (v4.136.0) — pure helpers, unit-tested.
// Two independent clocks answer "what is the pipeline actually doing":
//   textAge — time since the last NON-EMPTY transcript (any confidence).
//   msgAge  — time since the last Deepgram websocket message of ANY kind
//             (empty keepalive Results during dead air count as life).
//
// The old chip clock ticked only on confidence > 0.4 transcripts, so mumbled
// stretches aged it to red "DG STUCK" while text still flowed — and the clock
// was never reset by Zap, so a rebuilt connection stayed red until the first
// confident hit. Callers must seed `lastDeepgramMessageAt` with Date.now() at
// every connect (useDeepgram tryStartStreaming does), so stall is always
// measured from the current connection, never from a pre-stall transcript.

/** A transcript this fresh means the board is provably receiving text. */
export const DG_FRESH_TEXT_MS = 30000;

/** No Deepgram message at all for this long = amber "waiting" (not a fault). */
export const DG_QUIET_MS = 30000;

/** No Deepgram message at all for this long = red, Zap-worthy stall. */
export const DG_STUCK_MS = 60000;

/**
 * Truthful health flags for the DG status chip.
 * Zero timestamps mean "nothing known yet" → textAge/msgAge = Infinity →
 * they can read quiet/stuck but never TEXT ✓ (never fake-fresh either).
 * Off-call (warm idle ear) is never stale — v4.100.3 behavior kept.
 */
export function dgStatus({
  connectionState,
  isActive,
  lastDataTime = 0,
  lastDeepgramMessageAt = 0,
  enOpen = true,
  esOpen = true,
  now = Date.now(),
} = {}) {
  const inCall = isActive && connectionState === 'connected';
  const textAge = lastDataTime ? now - lastDataTime : Infinity;
  const msgAge = lastDeepgramMessageAt ? now - lastDeepgramMessageAt : Infinity;
  const freshText = inCall && textAge < DG_FRESH_TEXT_MS;
  const socketsOk = enOpen && esOpen;
  // Tiers are exclusive: QUIET is the 30–60s amber band only; past 60s (or a
  // lost socket) the state is STUCK, not QUIET.
  const stuck = inCall && (!socketsOk || msgAge > DG_STUCK_MS);
  const quiet = inCall && !stuck && socketsOk && msgAge > DG_QUIET_MS;
  return { inCall, freshText, quiet, stuck };
}

/** Max auto-reconnects the connect watchdog will spend on a dead pipe before
 * hard-failing with an actionable message. v4.148.0. */
export const CONNECT_STALL_MAX_RETRIES = 3;

/**
 * A socket state is healthy when opened — or intentionally not opened:
 * Multilingual (auto-detect) mode runs ONE socket and marks the other
 * 'skipped' (useDeepgram tryStartStreaming). 'skipped' used to read as a
 * lost socket → instant red "DG STUCK" / amber cat on every connect.
 */
export const isSocketHealthy = (state) => state === 'open' || state === 'skipped';

/**
 * v4.148.1 — mid-call stall recovery rules. The DG message clock is truthful
 * (v4.136) and connect-time dead pipes self-heal in 12s (v4.148.0), so the old
 * 65s auto-Zap wait — sized when a frozen clock caused Zap loops — is halved.
 * Empty keepalive Results during dead air count as life, so 35s of TOTAL
 * silence while audio still flows means Deepgram, not the caller, went quiet.
 */
export const DG_AUTO_ZAP_SILENCE_MS = 35000;

/** Recorder must still be sending audio, else it's the watchdog's failure. */
export const DG_AUTO_ZAP_AUDIO_FRESH_MS = 15000;

/** Max one recovery Zap per 2 min — bounds churn if a false positive slips through. */
export const DG_AUTO_ZAP_COOLDOWN_MS = 120000;

export function shouldAutoZap({ msgAgeMs, audioProgressAgeMs, sinceLastZapMs }) {
  if (msgAgeMs == null || msgAgeMs < DG_AUTO_ZAP_SILENCE_MS) return false;
  if (audioProgressAgeMs == null || audioProgressAgeMs > DG_AUTO_ZAP_AUDIO_FRESH_MS) return false;
  return sinceLastZapMs >= DG_AUTO_ZAP_COOLDOWN_MS;
}

/**
 * v4.148.0 — verdict for the 12s connect watchdog. The old watchdog stood down
 * the moment audio was being sent, so "Deepgram accepted the socket but never
 * sent ANYTHING (not even startup Metadata)" sat 'connected' until the 60s red
 * chip and a manual Zap — the first minute of a call lost. Audio flowing +
 * zero Deepgram messages back = dead pipe; recover within 12s instead.
 *
 * Returns:
 *   'ok'             — Deepgram proved alive (any message) or text already flowed.
 *   'fail-no-audio'  — audio never reached Deepgram (existing TIMEOUT guidance).
 *   'stall-reconnect'— audio sent, Deepgram mute, retries left → auto reconnect.
 *   'fail-silent'    — same stall but retry budget spent → hard fail.
 */
export function connectStallVerdict({
  audioChunksSent = false,
  transcriptReceived = false,
  gotDgMessage = false,
  retriesLeft = 0,
} = {}) {
  if (transcriptReceived || gotDgMessage) return 'ok';
  if (!audioChunksSent) return 'fail-no-audio';
  return retriesLeft > 0 ? 'stall-reconnect' : 'fail-silent';
}
