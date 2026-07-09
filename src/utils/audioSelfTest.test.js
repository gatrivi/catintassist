import { classifyHealthScore, formatHealthDisplay, truncateDeviceLabel, createTestToneUrl, isLocalOnlySoundboardPlayback } from './audioSelfTest';

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

  test('isLocalOnlyPlayback when mic or test mode', () => {
    expect(isLocalOnlySoundboardPlayback(false, false)).toBe(false);
    expect(isLocalOnlySoundboardPlayback(true, false)).toBe(true);
    expect(isLocalOnlySoundboardPlayback(false, true)).toBe(true);
  });
});
