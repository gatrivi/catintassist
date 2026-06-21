import {
  isSplashSeenThisSession,
  markSplashSeenThisSession,
  SPLASH_SEEN_KEY,
} from './splashStorage';

describe('splashStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('not seen by default', () => {
    expect(isSplashSeenThisSession()).toBe(false);
  });

  test('mark seen persists in session', () => {
    markSplashSeenThisSession();
    expect(sessionStorage.getItem(SPLASH_SEEN_KEY)).toBe('1');
    expect(isSplashSeenThisSession()).toBe(true);
  });
});
