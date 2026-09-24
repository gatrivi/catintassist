/**
 * v4.145.0 — sticky-bottom decisions (pure, no browser needed).
 * See `stickyScroll.js` for the story: the pane must always show the newest
 * line, and ONLY a real operator gesture may pause that.
 */
import {
  AT_BOTTOM_SLACK_PX,
  PROGRAMMATIC_GRACE_MS,
  RESUME_AFTER_USER_MS,
  classifyScroll,
  distanceFromBottom,
  isAtBottom,
  readScrollMetrics,
  shouldFollow,
} from './stickyScroll';

const metrics = (scrollTop, scrollHeight, clientHeight) => ({ scrollTop, scrollHeight, clientHeight });

describe('stickyScroll — newest transcript line stays visible', () => {
  test('distanceFromBottom reports the unseen pixels below the fold', () => {
    expect(distanceFromBottom(metrics(0, 1000, 300))).toBe(700);
    expect(distanceFromBottom(metrics(700, 1000, 300))).toBe(0);
  });

  test('overscroll / empty pane never reports a negative distance', () => {
    expect(distanceFromBottom(metrics(999, 1000, 300))).toBe(0);
    expect(distanceFromBottom(metrics(0, 0, 0))).toBe(0);
  });

  test('at bottom within the slack, not at bottom past it', () => {
    expect(isAtBottom(metrics(700 - AT_BOTTOM_SLACK_PX, 1000, 300))).toBe(true);
    expect(isAtBottom(metrics(700 - AT_BOTTOM_SLACK_PX - 1, 1000, 300))).toBe(false);
  });

  test('readScrollMetrics survives a missing pane (null)', () => {
    expect(readScrollMetrics(null)).toEqual({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  });

  test('follows only while the toggle is on and the operator is at the bottom', () => {
    expect(shouldFollow({ sticky: true, userScrolledUp: false })).toBe(true);
    expect(shouldFollow({ sticky: true, userScrolledUp: true })).toBe(false);
    expect(shouldFollow({ sticky: false, userScrolledUp: false })).toBe(false);
  });

  test('our own scroll (grace window) is never blamed on the operator', () => {
    const now = 1000;
    expect(classifyScroll({ now, programmaticUntil: now + PROGRAMMATIC_GRACE_MS - 1 })).toBe('self');
    expect(classifyScroll({ now, programmaticUntil: now - 1, userGesture: true })).toBe('user');
  });

  test('a scroll nobody touched is "content" (anchoring) — never a reason to stop following', () => {
    expect(classifyScroll({ now: 5000, programmaticUntil: 0, userGesture: false })).toBe('content');
  });

  test('resume window is long enough to read back, short enough to be safe', () => {
    expect(RESUME_AFTER_USER_MS).toBeGreaterThanOrEqual(5000);
    expect(RESUME_AFTER_USER_MS).toBeLessThanOrEqual(30000);
  });

  test('the "we scrolled it ourselves" window stays short — no blind spot', () => {
    expect(PROGRAMMATIC_GRACE_MS).toBeLessThanOrEqual(500);
  });

  test('a live gesture outranks our own grace window', () => {
    const now = 1000;
    expect(classifyScroll({ now, programmaticUntil: now + 500, userGesture: true })).toBe('user');
  });
});
