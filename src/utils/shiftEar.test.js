/**
 * v4.172.0 — SHIFT EAR policy.
 *
 * What these lock down are the two things that could cost real money or real
 * text: a warm pair must never be recycled while a call is live, and a dead
 * socket must come back without ever letting the recorder start off-call.
 */
import {
  shouldRearmEar,
  shouldRefillRearmBudget,
  earSocketAction,
  isOrphanedResume,
  EAR_REARM_MAX,
  EAR_REARM_RESET_MS,
  EAR_ROTATE_AGE_MS,
  EAR_RELEASE_IDLE_MS,
  EAR_ORPHAN_RESUME_MS,
  isEarPairDead,
  EAR_OPEN_GRACE_MS,
} from './shiftEar';

describe('shouldRearmEar', () => {
  const alive = { rearms: 0, streamAlive: true, inCall: false };

  test('re-arms off-call with a live stream — no operator press', () => {
    expect(shouldRearmEar(alive)).toBe(true);
  });

  test('never re-arms mid-call: the call path owns that reconnect ladder', () => {
    expect(shouldRearmEar({ ...alive, inCall: true })).toBe(false);
  });

  test('never re-arms with nothing to attach to', () => {
    expect(shouldRearmEar({ ...alive, streamAlive: false })).toBe(false);
  });

  test('stops after the budget — a flapping network cannot hammer Deepgram', () => {
    expect(shouldRearmEar({ ...alive, rearms: EAR_REARM_MAX - 1 })).toBe(true);
    expect(shouldRearmEar({ ...alive, rearms: EAR_REARM_MAX })).toBe(false);
  });

  test('spacing is NOT a refusal — the tick asks again in 4s', () => {
    // Refusing a second later would tear the ear down after ONE re-arm, which is
    // the "goes deaf mid-shift, I have to press CONNECT" bug being fixed.
    expect(shouldRearmEar({ ...alive, lastRearmAt: Date.now() })).toBe(true);
  });
});

describe('shouldRefillRearmBudget', () => {
  test('a pair that survived a minute proved the network — budget handed back', () => {
    // Deepgram drops long sessions, so a shift can need far more than 3 re-arms.
    // A lifetime cap would leave the ear deaf in the middle of the afternoon.
    expect(
      shouldRefillRearmBudget({ socketAgeMs: EAR_REARM_RESET_MS, rearms: 1 }),
    ).toBe(true);
  });

  test('a pair that died immediately proved nothing', () => {
    expect(
      shouldRefillRearmBudget({ socketAgeMs: EAR_REARM_RESET_MS - 1, rearms: 1 }),
    ).toBe(false);
  });

  test('nothing to hand back when nothing was spent', () => {
    expect(shouldRefillRearmBudget({ socketAgeMs: EAR_REARM_RESET_MS * 5, rearms: 0 })).toBe(false);
  });
});

describe('earSocketAction', () => {
  const warm = { earActive: true, inCall: false, socketAgeMs: 0, idleSinceMs: 0 };

  test('a freshly warmed, recently-used pair is left alone', () => {
    expect(earSocketAction(warm)).toBe('none');
  });

  test('a live call is never interrupted for housekeeping', () => {
    expect(
      earSocketAction({
        ...warm,
        inCall: true,
        socketAgeMs: EAR_ROTATE_AGE_MS * 3,
        idleSinceMs: EAR_RELEASE_IDLE_MS * 2,
      }),
    ).toBe('none');
  });

  test('an inactive ear does nothing', () => {
    expect(earSocketAction({ ...warm, earActive: false })).toBe('none');
  });

  test('rotates an old warm pair before Deepgram drops it', () => {
    expect(earSocketAction({ ...warm, socketAgeMs: EAR_ROTATE_AGE_MS })).toBe('rotate');
  });

  test('release outranks rotate — an idle shift gives the slot back', () => {
    expect(
      earSocketAction({
        ...warm,
        socketAgeMs: EAR_ROTATE_AGE_MS,
        idleSinceMs: EAR_RELEASE_IDLE_MS,
      }),
    ).toBe('release');
  });

  test('one hour of silence releases the pair (no socket held overnight)', () => {
    expect(earSocketAction({ ...warm, idleSinceMs: EAR_RELEASE_IDLE_MS })).toBe('release');
    expect(earSocketAction({ ...warm, idleSinceMs: EAR_RELEASE_IDLE_MS - 1 })).toBe('none');
  });

  test('release is NOT clock-based: staying late keeps the ear warm', () => {
    // The scoreboard ships "how late should I stay" — an 18:00 kill timer would
    // cost a manual CONNECT during exactly the minutes being chased.
    expect(earSocketAction({ ...warm, idleSinceMs: 50 * 60 * 1000 })).toBe('none');
  });
});

describe('isOrphanedResume', () => {
  test('a resume with no call is stopped before minutes go uncounted', () => {
    expect(isOrphanedResume({ isActive: false, resumeAgeMs: EAR_ORPHAN_RESUME_MS })).toBe(true);
  });

  test('a resume that became a call is left streaming', () => {
    expect(isOrphanedResume({ isActive: true, resumeAgeMs: EAR_ORPHAN_RESUME_MS * 10 })).toBe(false);
  });

  test('gives a starting call the full grace window', () => {
    expect(isOrphanedResume({ isActive: false, resumeAgeMs: EAR_ORPHAN_RESUME_MS - 1 })).toBe(false);
  });
});

describe('isEarPairDead', () => {
  test('one open lane is enough — the pair is alive', () => {
    expect(isEarPairDead({ openCount: 1, pendingCount: 0, pairAgeMs: 0 })).toBe(false);
    expect(isEarPairDead({ openCount: 2, pendingCount: 0, pairAgeMs: 999999 })).toBe(false);
  });

  test('mid-handshake is NOT dead (the 4s tick must not replace its own pair)', () => {
    // A clinic wifi can take >4s for TLS + upgrade; treating that as a death made
    // the ear churn pairs until it gave up with "press CONNECT".
    expect(isEarPairDead({ openCount: 0, pendingCount: 2, pairAgeMs: 4000 })).toBe(false);
    expect(
      isEarPairDead({ openCount: 0, pendingCount: 2, pairAgeMs: EAR_OPEN_GRACE_MS - 1 }),
    ).toBe(false);
  });

  test('a handshake that never completes is recovered after the grace', () => {
    expect(isEarPairDead({ openCount: 0, pendingCount: 2, pairAgeMs: EAR_OPEN_GRACE_MS })).toBe(true);
  });

  test('nothing open and nothing pending is dead', () => {
    expect(isEarPairDead({ openCount: 0, pendingCount: 0, pairAgeMs: 1000 })).toBe(true);
    // A dropped socket leaves no CONNECTING remnant — this is the real death.
    expect(isEarPairDead({ openCount: 0, pendingCount: 1, pairAgeMs: 1000 })).toBe(false);
  });
});
