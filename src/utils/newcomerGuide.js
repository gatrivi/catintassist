/** Persistent dismiss for idle onboarding copy. */
const STORAGE_KEY = 'catint_newcomer_dismissed';
const STORAGE_SNOOZED_KEY = 'catint_newcomer_snoozed';

export const isNewcomerGuideDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const isNewcomerGuideSnoozed = () => {
  try {
    return localStorage.getItem(STORAGE_SNOOZED_KEY) === '1';
  } catch {
    return false;
  }
};

export const snoozeNewcomerGuide = () => {
  try {
    localStorage.setItem(STORAGE_SNOOZED_KEY, '1');
  } catch {
    /* ignore */
  }
};

export const unsnoozeNewcomerGuide = () => {
  try {
    localStorage.removeItem(STORAGE_SNOOZED_KEY);
  } catch {
    /* ignore */
  }
};

export const dismissNewcomerGuidePermanent = () => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
    localStorage.removeItem(STORAGE_SNOOZED_KEY);
  } catch {
    /* ignore */
  }
};
