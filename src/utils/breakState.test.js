import {
  shouldAutoBreak,
  shouldResetWorkTimer,
  BREAK_SILENCE_GRACE_SECS,
  LONG_BREAK_STINT_SECS,
} from './breakState';

describe('breakState auto-break rules', () => {
  it('counts break after 3s of no transcription, unless on hold', () => {
    expect(shouldAutoBreak({ isHold: false, silenceSecs: 3 })).toBe(true);
    expect(shouldAutoBreak({ isHold: false, silenceSecs: BREAK_SILENCE_GRACE_SECS - 0.1 })).toBe(false);
    expect(shouldAutoBreak({ isHold: false, silenceSecs: 600 })).toBe(true);
    // hold (provider keywords) pauses break counting
    expect(shouldAutoBreak({ isHold: true, silenceSecs: 600 })).toBe(false);
  });

  it('only long stints reset the working-without-break clock', () => {
    expect(shouldResetWorkTimer(3)).toBe(false);
    expect(shouldResetWorkTimer(LONG_BREAK_STINT_SECS - 1)).toBe(false);
    expect(shouldResetWorkTimer(LONG_BREAK_STINT_SECS)).toBe(true);
    expect(shouldResetWorkTimer(1200)).toBe(true);
  });
});
