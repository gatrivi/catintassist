export const GUIDE_LANG_KEY = 'catint_guide_lang_v1';

export const loadGuideLang = () => {
  try {
    return localStorage.getItem(GUIDE_LANG_KEY) === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
};

export const saveGuideLang = (lang) => {
  try {
    localStorage.setItem(GUIDE_LANG_KEY, lang === 'es' ? 'es' : 'en');
  } catch (_) {}
};
