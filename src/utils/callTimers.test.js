import { isSameLocalDay, isLastCallValidToday, offCallGapSeconds } from './callTimers';

/** v4.124.0 — ON/OFF/LAST counter helpers. */
describe('callTimers', () => {
  const noon = new Date(2026, 8, 17, 12, 0, 0).getTime();
  const morning = new Date(2026, 8, 17, 9, 30, 0).getTime();
  const yesterday = new Date(2026, 8, 16, 12, 0, 0).getTime();

  test('isSameLocalDay matches same calendar day only', () => {
    expect(isSameLocalDay(noon, morning)).toBe(true);
    expect(isSameLocalDay(noon, yesterday)).toBe(false);
    expect(isSameLocalDay(0, noon)).toBe(false);
    expect(isSameLocalDay(null, noon)).toBe(false);
  });

  test('isLastCallValidToday rejects missing + yesterday stamps', () => {
    expect(isLastCallValidToday(0, noon)).toBe(false);
    expect(isLastCallValidToday(yesterday, noon)).toBe(false);
    expect(isLastCallValidToday(morning, noon)).toBe(true);
  });

  test('offCallGapSeconds ticks since call end, 0 on-call or no call', () => {
    const endedAt = noon - 754 * 1000; // 12:34 gap
    expect(offCallGapSeconds({ isActive: false, lastCallEndedAt: endedAt, nowMs: noon })).toBe(754);
    expect(offCallGapSeconds({ isActive: true, lastCallEndedAt: endedAt, nowMs: noon })).toBe(0);
    expect(offCallGapSeconds({ isActive: false, lastCallEndedAt: 0, nowMs: noon })).toBe(0);
    expect(offCallGapSeconds({ isActive: false, lastCallEndedAt: yesterday, nowMs: noon })).toBe(0);
  });

  test('offCallGapSeconds never goes negative (clock skew)', () => {
    expect(offCallGapSeconds({ isActive: false, lastCallEndedAt: noon + 5000, nowMs: noon })).toBe(0);
  });
});
