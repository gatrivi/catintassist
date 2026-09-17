import { GHOST_CALL_SILENCE_SECONDS, shouldAutoEndGhostCall } from './callEndGuard';

test('ends only a confirmed seven-minute ghost call', () => {
  expect(shouldAutoEndGhostCall({ silenceSecs: GHOST_CALL_SILENCE_SECONDS + 1, promptCount: 3, isHold: false })).toBe(true);
  expect(shouldAutoEndGhostCall({ silenceSecs: GHOST_CALL_SILENCE_SECONDS + 1, promptCount: 3, isHold: true })).toBe(false);
  expect(shouldAutoEndGhostCall({ silenceSecs: GHOST_CALL_SILENCE_SECONDS + 1, promptCount: 2, isHold: false })).toBe(false);
});

test('never ends when the STT path is down (outage/reconnect is not a call end)', () => {
  const silent = { silenceSecs: GHOST_CALL_SILENCE_SECONDS + 600, promptCount: 3, isHold: false };
  expect(shouldAutoEndGhostCall({ ...silent, dgConnected: false })).toBe(false);
  expect(shouldAutoEndGhostCall({ ...silent, dgConnected: true })).toBe(true);
});
