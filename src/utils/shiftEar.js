/**
 * v4.172.0 — SHIFT EAR policy (pure, no side effects).
 *
 * The ask: stop tearing Deepgram's sockets down on every call. Deepgram bills
 * audio duration processed, NOT connection time, and does not charge for
 * silence — a warm socket that only receives `KeepAlive` frames costs $0.
 *
 * MEASURED, not trusted from docs (probe run 28-09 against the live account): a
 * listen socket that received ONLY KeepAlive frames — never a single audio byte
 * — stayed open 100s+ with no close. Deepgram's own troubleshooting page claims
 * "Using KeepAlive messages alone will not prevent closure"; that claim does not
 * hold for the listen endpoint, and this design rests on the measurement.
 *
 * What is NOT assumed: that a socket lives forever. Deepgram documents no max
 * session length for streaming STT — what it documents instead is that a
 * long-running client should "initialize a new WebSocket connection and start a
 * new streaming session" when one drops. So a shift-long socket must EXPECT to
 * die and re-arm with no operator press. That silent re-arm is the actual fix
 * for "it connects and disconnects every call".
 *
 * Re-arm and rotation are only ever allowed OFF-CALL: a pair we choose to
 * recycle must never be the one carrying a live call.
 *
 * MONEY SAFETY (v4.99.2, 893 phantom minutes): billable time accrues only from
 * SessionContext `isActive`, never from socket state. Nothing here may imply
 * "in a call" — it decides socket plumbing only.
 */

/**
 * Re-arm at most this often while the pair keeps dying. A flapping network then
 * costs 3 attempts (the ear's tick spaces them ~4s apart by itself) and the app
 * says so honestly instead of hammering Deepgram all afternoon.
 */
export const EAR_REARM_MAX = 3;

/**
 * A pair that has stayed open this long has proven the network works, so the
 * budget is handed back. Without this, a shift in which Deepgram drops the
 * socket once an hour would hit a cap of 3 and go deaf long before the operator
 * finished working.
 */
export const EAR_REARM_RESET_MS = 60 * 1000;

export function shouldRefillRearmBudget({ socketAgeMs = 0, rearms = 0 } = {}) {
  return rearms > 0 && socketAgeMs >= EAR_REARM_RESET_MS;
}

/**
 * The ear's KeepAlive tick noticed both sockets are gone. Quietly open a fresh
 * pair on the SAME preserved stream?
 *
 * Deliberately only PERMANENT refusals here: a short gap since the last re-arm
 * is not exhaustion, because the tick asks again in 4s. Treating "too soon" as
 * giving up would tear the ear down after a single re-arm — the exact "goes deaf
 * mid-shift" bug this exists to fix.
 */
export function shouldRearmEar({
  rearms = 0,
  streamAlive = false,
  inCall = false,
} = {}) {
  if (inCall) return false; // the call path has its own reconnect ladder
  if (!streamAlive) return false; // nothing to attach a new pair to
  if (rearms >= EAR_REARM_MAX) return false;
  // Do NOT refuse on "too soon since last re-arm": the tick asks again in 4s,
  // and treating a short gap as exhaustion would tear the ear down after ONE
  // re-arm — the exact "goes deaf mid-shift" bug this exists to fix.
  return true;
}

/** Recycle a warm pair once it is this old — off-call gaps only. */
export const EAR_ROTATE_AGE_MS = 45 * 60 * 1000;

/**
 * Nothing has happened for this long → release the pair (CloseStream) and stop
 * pinging; the local VAD keeps watching and a later wake re-opens. Deliberately
 * NOT a clock: the scoreboard exists because the operator stays late ("how late
 * should I stay" is a shipped metric), so an 18:00 kill timer would cost a
 * manual CONNECT during exactly the overtime minutes they are chasing. Silence
 * is the honest signal, and it is also what stops a socket being held overnight.
 */
export const EAR_RELEASE_IDLE_MS = 60 * 60 * 1000;

/**
 * What the warm pair should do on this tick.
 * @returns {'none'|'rotate'|'release'} — `none` always while a call is live.
 */
export function earSocketAction({
  earActive = false,
  inCall = false,
  socketAgeMs = 0,
  idleSinceMs = 0,
} = {}) {
  if (!earActive || inCall) return 'none';
  if (idleSinceMs >= EAR_RELEASE_IDLE_MS) return 'release';
  if (socketAgeMs >= EAR_ROTATE_AGE_MS) return 'rotate';
  return 'none';
}

/**
 * A freshly opened pair spends time in CONNECTING (a TLS + upgrade handshake over
 * a clinic wifi is routinely 2-4s, occasionally far worse). The KeepAlive tick
 * runs every 4s, and treating "not open yet" as "dead" would replace a pair that
 * is merely handshaking — churning sockets, burning the re-arm budget, and ending
 * in "giving up, press CONNECT" on exactly the slow networks that need the ear.
 * Only a pair that never opens AND never closes within this window is stuck.
 */
export const EAR_OPEN_GRACE_MS = 20000;

/**
 * Is the warm pair actually gone (vs merely still opening)?
 * @param {number} openCount     lanes reporting OPEN
 * @param {number} pendingCount  lanes still CONNECTING
 * @param {number} pairAgeMs     age of the current pair
 */
export function isEarPairDead({
  openCount = 0,
  pendingCount = 0,
  pairAgeMs = 0,
} = {}) {
  if (openCount > 0) return false;
  if (pendingCount > 0) return pairAgeMs >= EAR_OPEN_GRACE_MS;
  return true; // nothing open, nothing pending: closed or never created
}

/**
 * The VAD woke the recorder but no call ever became active (call detection off,
 * or the operator never pressed CALL START). Audio must not keep streaming to
 * Deepgram for an uncounted stretch — back to warm KeepAlive.
 */
export const EAR_ORPHAN_RESUME_MS = 30000;

export function isOrphanedResume({ isActive = false, resumeAgeMs = 0 } = {}) {
  if (isActive) return false;
  return resumeAgeMs >= EAR_ORPHAN_RESUME_MS;
}
