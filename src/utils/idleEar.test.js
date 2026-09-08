import {
  shouldWakeFromVad,
  updateVadLoudFrames,
  IDLE_EAR_RMS_THRESHOLD,
  IDLE_EAR_TRIGGER_FRAMES,
} from './idleEar';

describe('idleEar VAD wake rules', () => {
  it('needs N consecutive loud frames to wake', () => {
    expect(shouldWakeFromVad(IDLE_EAR_TRIGGER_FRAMES)).toBe(true);
    expect(shouldWakeFromVad(10)).toBe(true);
    expect(shouldWakeFromVad(IDLE_EAR_TRIGGER_FRAMES - 1)).toBe(false);
    expect(shouldWakeFromVad(0)).toBe(false);
  });

  it('counts loud frames and resets on silence', () => {
    const loud = { rms: IDLE_EAR_RMS_THRESHOLD, prevLoudFrames: 0 };
    const next = updateVadLoudFrames(loud);
    expect(next).toBe(1);
    expect(updateVadLoudFrames({ ...loud, prevLoudFrames: next })).toBe(2);
    // quiet frame resets the streak
    expect(updateVadLoudFrames({ rms: 0.001, prevLoudFrames: 2 })).toBe(0);
  });
});
