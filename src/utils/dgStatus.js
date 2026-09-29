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
 * v4.149.0 — mid-call stall recovery, gated by SPEECH EVIDENCE. Two failures
 * look identical on the message clock but need different fixes:
 *   dead Deepgram pipe → a Zap rebuilds it.
 *   silent audio route (mic/tab/headset died) → a Zap is useless.
 * A local RMS check on the outgoing stream separates them:
 *   15s+ of zero Deepgram messages WHILE someone is audibly speaking = dead
 *   pipe → Zap fast. Dead air (nothing loud locally) is not a fault — Zap
 *   would only churn. 35s of total silence still Zaps regardless (covers a
 *   pipe that dies while nobody talks), same recorder + cooldown guards.
 */
export const DG_ZAP_SPEAKING_SILENCE_MS = 15000;
export const DG_AUTO_ZAP_SILENCE_MS = 35000;

/** "Speaking recently" = outgoing RMS was loud within this window. */
export const DG_SPEAKING_FRESH_MS = 10000;

/** Recorder must still be sending audio, else it's the watchdog's failure. */
export const DG_AUTO_ZAP_AUDIO_FRESH_MS = 15000;

/** Max one recovery Zap per 2 min — bounds churn if a false positive slips through. */
export const DG_AUTO_ZAP_COOLDOWN_MS = 120000;

export function shouldAutoZap({
  msgAgeMs,
  audioProgressAgeMs,
  sinceLastZapMs,
  speakingAgeMs = Infinity,
}) {
  const audioFresh =
    audioProgressAgeMs != null && audioProgressAgeMs <= DG_AUTO_ZAP_AUDIO_FRESH_MS;
  const cooledDown = sinceLastZapMs != null && sinceLastZapMs >= DG_AUTO_ZAP_COOLDOWN_MS;
  if (!audioFresh || !cooledDown) return false;
  if (msgAgeMs == null) return false;
  if (msgAgeMs >= DG_AUTO_ZAP_SILENCE_MS) return true;
  if (msgAgeMs < DG_ZAP_SPEAKING_SILENCE_MS) return false;
  return speakingAgeMs != null && speakingAgeMs <= DG_SPEAKING_FRESH_MS;
}

/**
 * v4.170.0 — mid-call silent-recorder recovery. shouldAutoZap() refuses to Zap
 * unless the recorder is still emitting audio (audioProgressAgeMs ≤15s), which
 * is right: rebuilding sockets cannot fix a recorder that stopped producing
 * chunks. But nothing else covered that case, so a MediaRecorder that died
 * mid-call (Chrome does this on getDisplayMedia tracks, and on a wake from the
 * idle ear) stayed 'connected' and silent for the rest of the call — the
 * operator's only fix was manual ZAP, several times.
 *
 * MediaRecorder emits chunks on SILENCE too (it encodes it), so audio going
 * quiet for 10s+ while we believe we are live is a dead recorder, not dead
 * air. Rebuild the recorder on the already-open sockets: no socket churn, no
 * transcript loss, no user press.
 */
export const RECORDER_REBUILD_SILENCE_MS = 10000;
export const RECORDER_REBUILD_COOLDOWN_MS = 30000;
export const RECORDER_REBUILD_MAX = 3;

export function shouldRebuildRecorder({
  audioProgressAgeMs,
  sinceLastRebuildMs = Infinity,
  rebuilds = 0,
}) {
  if (rebuilds >= RECORDER_REBUILD_MAX) return false;
  if (sinceLastRebuildMs < RECORDER_REBUILD_COOLDOWN_MS) return false;
  return audioProgressAgeMs != null && audioProgressAgeMs >= RECORDER_REBUILD_SILENCE_MS;
}

/**
 * v4.148.0 — verdict for the 12s connect watchdog. The old watchdog stood down
 * the moment audio was being sent, so "Deepgram accepted the socket but never
 * sent ANYTHING (not even startup Metadata)" sat 'connected' until the 60s red
 * chip and a manual Zap — the first minute of a call lost. Audio flowing +
 * zero Deepgram messages back = dead pipe; recover within 12s instead.
 *
 * v4.170.0 — the mirror failure: sockets open, Deepgram silent, and OUR
 * recorder never emitted a single chunk. Chrome does this with getDisplayMedia
 * (hidden/occluded shared tab, or a MediaRecorder that starts and stays idle).
 * A socket Zap cannot fix that — rebuilding the recorder on the SAME open
 * sockets can, so it is tried before the red TIMEOUT the operator used to
 * clear by pressing ZAP five times.
 *
 * Returns:
 *   'ok'               — Deepgram proved alive (any message) or text already flowed.
 *   'recorder-rebuild' — sockets open, no audio ever left us, rebuild budget left.
 *   'fail-no-audio'    — audio never reached Deepgram and a rebuild won't help.
 *   'stall-reconnect'  — audio sent, Deepgram mute, retries left → auto reconnect.
 *   'fail-silent'      — same stall but retry budget spent → hard fail.
 */
export const CONNECT_RECORDER_MAX_RETRIES = 1;

export function connectStallVerdict({
  audioChunksSent = false,
  transcriptReceived = false,
  gotDgMessage = false,
  retriesLeft = 0,
  recorderRetriesLeft = 0,
} = {}) {
  if (transcriptReceived || gotDgMessage) return 'ok';
  if (!audioChunksSent) {
    return recorderRetriesLeft > 0 ? 'recorder-rebuild' : 'fail-no-audio';
  }
  return retriesLeft > 0 ? 'stall-reconnect' : 'fail-silent';
}
