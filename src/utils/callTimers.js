/** Call timers — pure helpers for the ON/OFF/LAST HUD counters (v4.124.0).
 * Toddler-simple: no imports, no side effects, fully unit-tested.
 */

/** True when both timestamps fall on the same local calendar day. */
export function isSameLocalDay(aMs, bMs) {
  if (!aMs || !bMs) return false;
  try {
    return new Date(aMs).toDateString() === new Date(bMs).toDateString();
  } catch (_) {
    return false;
  }
}

/** Last-call block is only valid when the call ended today (no stale gaps). */
export function isLastCallValidToday(lastCallEndedAt, nowMs = Date.now()) {
  if (!lastCallEndedAt) return false;
  return isSameLocalDay(lastCallEndedAt, nowMs);
}

/**
 * Seconds since the last call ended (live OFF-call gap).
 * Returns 0 when off-call gap doesn't apply (on a call, or no call today).
 */
export function offCallGapSeconds({ isActive, lastCallEndedAt, nowMs = Date.now() }) {
  if (isActive) return 0;
  if (!isLastCallValidToday(lastCallEndedAt, nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - lastCallEndedAt) / 1000));
}
