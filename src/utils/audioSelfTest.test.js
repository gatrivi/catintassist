import {
  classifyHealthScore,
  formatHealthDisplay,
  truncateDeviceLabel,
  createTestToneUrl,
  isLocalOnlySoundboardPlayback,
  getPreflightSteps,
  isPreflightReady,
  isClipHealthOk,
} from './audioSelfTest';

describe('audioSelfTest', () => {
  test('classifyHealthScore peaches at high confidence', () => {
    expect(classifyHealthScore(0.95).label).toBe('PEACHES');
  });

  test('truncateDeviceLabel shortens long names', () => {
    expect(truncateDeviceLabel('Very Long Device Name Here', 10).length).toBeLessThanOrEqual(10);
  });

  test('formatHealthDisplay adds emoji tiers', () => {
    expect(formatHealthDisplay(0.95)?.label).toContain('PEACHES');
    expect(formatHealthDisplay(0.1)?.label).toContain('UNACCEPTABLE');
    expect(formatHealthDisplay(undefined)).toBeNull();
  });

  test('createTestToneUrl builds wav buffer', () => {
    if (typeof URL.createObjectURL !== 'function') {
      expect(createTestToneUrl).toBeDefined();
      return;
    }
    const url = createTestToneUrl(100);
    expect(url).toMatch(/^blob:/);
    URL.revokeObjectURL(url);
  });

  test('isLocalOnlyPlayback when mic mode only', () => {
    expect(isLocalOnlySoundboardPlayback(false)).toBe(false);
    expect(isLocalOnlySoundboardPlayback(true)).toBe(true);
  });

  test('getPreflightSteps quality and caller gates', () => {
    const missing = getPreflightSteps({ hasClip: false, healthScore: undefined, callPathOk: false, awaitingConfirm: false });
    expect(missing.quality).toBe('missing');
    expect(missing.caller).toBe('missing');

    const ready = getPreflightSteps({ hasClip: true, healthScore: 0.92, callPathOk: true, awaitingConfirm: false });
    expect(ready.quality).toBe('ok');
    expect(ready.caller).toBe('ok');
    expect(isPreflightReady(ready)).toBe(true);

    const confirm = getPreflightSteps({ hasClip: true, healthScore: 0.8, callPathOk: false, awaitingConfirm: true });
    expect(confirm.caller).toBe('confirm');
    expect(isClipHealthOk(0.49)).toBe(false);
    expect(isClipHealthOk(0.5)).toBe(true);
  });
});
