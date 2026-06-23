import { classifyHealthScore, formatHealthDisplay, truncateDeviceLabel, createTestToneUrl } from './audioSelfTest';

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
});
