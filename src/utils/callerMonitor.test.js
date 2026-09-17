import { readCallerMonitor, writeCallerMonitor } from './callerMonitor';

describe('callerMonitor pref', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch (_) {}
  });

  test('defaults to OFF (sink-only, no local double-play)', () => {
    expect(readCallerMonitor()).toBe(false);
  });

  test('round-trips on/off', () => {
    writeCallerMonitor(true);
    expect(readCallerMonitor()).toBe(true);
    writeCallerMonitor(false);
    expect(readCallerMonitor()).toBe(false);
  });
});
