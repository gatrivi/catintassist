import {
  DEFAULT_COOLDOWN_MS,
  DEFAULT_TTL_MS,
  beginSoundboardAudioGuard,
  isSoundboardAudioSuppressed,
  resetSoundboardAudioGuard,
} from './soundboardCallGuard';

describe('soundboardCallGuard', () => {
  let now;
  let nowSpy;

  beforeEach(() => {
    now = 1_700_000_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    resetSoundboardAudioGuard();
  });

  afterEach(() => {
    nowSpy.mockRestore();
    resetSoundboardAudioGuard();
  });

  test('is not suppressed initially', () => {
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('suppresses while a token is active and through the 3s tail cooldown', () => {
    const release = beginSoundboardAudioGuard('sink_clip');

    expect(isSoundboardAudioSuppressed()).toBe(true);

    now += 1500;
    release();

    // Still suppressed during cooldown
    expect(isSoundboardAudioSuppressed()).toBe(true);

    now += DEFAULT_COOLDOWN_MS - 1;
    expect(isSoundboardAudioSuppressed()).toBe(true);

    // Expires right at cooldown boundary
    now += 1;
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('handles overlapping tokens without releasing early', () => {
    const releaseFirst = beginSoundboardAudioGuard('local_preview');
    now += 500;
    const releaseSecond = beginSoundboardAudioGuard('sink_clip');

    releaseFirst();
    // Second token is still active even past first token's cooldown
    now += DEFAULT_COOLDOWN_MS + 500;
    expect(isSoundboardAudioSuppressed()).toBe(true);

    releaseSecond();
    now += DEFAULT_COOLDOWN_MS - 1;
    expect(isSoundboardAudioSuppressed()).toBe(true);

    now += 1;
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('release() is idempotent and does not extend cooldown on repeat calls', () => {
    const release = beginSoundboardAudioGuard('local_preview');
    release();

    now += 2000;
    release(); // second call must be a no-op

    now += DEFAULT_COOLDOWN_MS - 2000; // reaches original cooldown expiry
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('clamps cooldown with Math.max so a shorter release cannot shorten an existing cooldown', () => {
    const releaseLong = beginSoundboardAudioGuard('recording', { cooldownMs: 5000 });
    const releaseShort = beginSoundboardAudioGuard('test_tone', { cooldownMs: 500 });

    releaseLong(); // sets suppressedUntil = now + 5000
    now += 100;
    releaseShort(); // would be now + 500, must not clobber now + 4900

    now += 1000; // past short cooldown, still inside long cooldown
    expect(isSoundboardAudioSuppressed()).toBe(true);

    now += 3900; // reaches long cooldown expiry
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('auto-expires leaked tokens after TTL so Idle Ear is never permanently blocked', () => {
    beginSoundboardAudioGuard('leaked_preview');

    now += DEFAULT_TTL_MS - 1;
    expect(isSoundboardAudioSuppressed()).toBe(true);

    now += 1;
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('respects custom ttlMs for long-running operations like recording', () => {
    beginSoundboardAudioGuard('recording', { ttlMs: 180_000 });

    now += DEFAULT_TTL_MS + 10_000;
    expect(isSoundboardAudioSuppressed()).toBe(true);

    now += 110_000; // total 180_000ms
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });

  test('resetSoundboardAudioGuard clears both active tokens and cooldown', () => {
    const release = beginSoundboardAudioGuard('sink_clip');
    release();
    beginSoundboardAudioGuard('local_preview');

    expect(isSoundboardAudioSuppressed()).toBe(true);

    resetSoundboardAudioGuard();
    expect(isSoundboardAudioSuppressed()).toBe(false);
  });
});
