/** Persistent dismiss for idle onboarding copy. */
const STORAGE_KEY = 'catint_newcomer_dismissed';

export const isNewcomerGuideDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const dismissNewcomerGuidePermanent = () => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
};
