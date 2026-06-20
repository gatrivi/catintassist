/** Interpreter wellbeing tools dock — hidden by default; remembers user choice. */
const STORAGE_KEY = 'catint_personal_dock';

export const isWellbeingDockEnabled = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setWellbeingDockEnabled = (enabled) => {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('cat_wellbeing_dock_changed'));
  } catch {
    /* ignore */
  }
};

// Backward compat aliases
export const isPersonalDockEnabled = isWellbeingDockEnabled;
export const setPersonalDockEnabled = setWellbeingDockEnabled;
