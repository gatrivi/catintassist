export const SPLASH_SEEN_KEY = 'catint_splash_seen_v1';

export const isSplashSeenThisSession = () => {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

export const markSplashSeenThisSession = () => {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
  } catch (_) {}
};

export const isOnboardingAnimationsDisabled = () => {
  try {
    return localStorage.getItem('catint_onboarding_anim_disabled_v1') === '1';
  } catch {
    return false;
  }
};
