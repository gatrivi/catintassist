/**
 * v4.145.0 — sticky-bottom follow for the transcript pane (`#transcript-pane`).
 *
 * WHY THIS FILE EXISTS
 * The old follow logic lived inline in `TranscriptionBoard.js` and guessed
 * "the operator scrolled away" from scroll geometry only. Every scroll event
 * that was NOT a human scrolled it:
 *   · the browser's scroll-anchoring, which moves the viewport on its own each
 *     time a live bubble grows → newest line pushed below the fold;
 *   · our own programmatic scroll.
 * One such event paused the follow for 15 s, so the interpreter could not read
 * the last line. Rule now: only a real gesture (wheel up / drag / scrollbar)
 * pauses the follow; anything else means "snap back to the newest line".
 *
 * Decisions are pure functions here so they can be unit tested with no layout.
 */

/** How close to the bottom still counts as "at the newest line". */
export const AT_BOTTOM_SLACK_PX = 48;

/** Ignore scroll events this long after we scrolled the pane ourselves. */
export const PROGRAMMATIC_GRACE_MS = 300;

/** Re-follow on its own this long after the operator scrolled away. */
export const RESUME_AFTER_USER_MS = 15000;

/** A wheel/drag counts as "user is scrolling" for this long. */
export const USER_GESTURE_HOLD_MS = 400;

/** Read the three numbers that decide everything (safe on a null element). */
export function readScrollMetrics(el) {
  if (!el) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
  return {
    scrollTop: el.scrollTop || 0,
    scrollHeight: el.scrollHeight || 0,
    clientHeight: el.clientHeight || 0,
  };
}

/** Pixels of unseen content below the fold (0 = the newest line is visible). */
export function distanceFromBottom({ scrollTop, scrollHeight, clientHeight }) {
  return Math.max(0, (scrollHeight || 0) - (clientHeight || 0) - (scrollTop || 0));
}

export function isAtBottom(metrics, slack = AT_BOTTOM_SLACK_PX) {
  return distanceFromBottom(metrics) <= slack;
}

/** Follow while the toggle is on AND the operator has not scrolled away. */
export function shouldFollow({ sticky, userScrolledUp }) {
  return Boolean(sticky) && !userScrolledUp;
}

/**
 * What caused one scroll event?
 *  'self'    → we scrolled the pane (inside the grace window) — ignore it.
 *  'user'    → wheel/drag is in progress — a human, respect the position.
 *  'content' → nobody touched it: layout/scroll-anchoring moved us. Never a
 *              reason to stop following — snap back instead.
 */
export function classifyScroll({ now, programmaticUntil = 0, userGesture = false }) {
  // A human action always outranks our own grace window.
  if (userGesture) return 'user';
  if (now < programmaticUntil) return 'self';
  return 'content';
}
