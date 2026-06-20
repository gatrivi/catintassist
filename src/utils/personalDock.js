/** Personal habit widgets (Rosary, chores, etc.) — hidden by default for demo/pro use. */
const STORAGE_KEY = 'catint_personal_dock';

export const isPersonalDockEnabled = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setPersonalDockEnabled = (enabled) => {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
