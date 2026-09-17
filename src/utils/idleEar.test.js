import {
  shouldWakeFromVad,
  updateVadLoudFrames,
  hasSpeechText,
  shouldSpeechAutoStart,
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

  it('starts on any audible text, even low-confidence mumbling (v4.123.0 fix B)', () => {
    const idle = { isActive: false, isZombie: false };
    expect(hasSpeechText('hello?')).toBe(true);
    expect(hasSpeechText('  ')).toBe(false);
    expect(hasSpeechText('')).toBe(false);
    expect(hasSpeechText(null)).toBe(false);
    // low-conf opener still starts — confidence is not in this gate
    expect(shouldSpeechAutoStart({ transcript: 'mumbld name', ...idle })).toBe(true);
    expect(shouldSpeechAutoStart({ transcript: '', ...idle })).toBe(false);
    expect(shouldSpeechAutoStart({ transcript: 'hi', isActive: true, isZombie: false })).toBe(false);
    expect(shouldSpeechAutoStart({ transcript: 'hi', isActive: false, isZombie: true })).toBe(false);
  });
});
