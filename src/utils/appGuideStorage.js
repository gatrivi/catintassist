const STORAGE_KEY = 'catint_guide_done';

export const isAppGuideDone = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const markAppGuideDone = () => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
};
