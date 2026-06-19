/** User transcript corrections — local-first storage — v4.56.0 handoff stub. */

export const CORRECTIONS_STORAGE_KEY = 'catint_corrections_v1';

const normalizeKey = (text, lang) => {
  const normText = (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normLang = (lang || 'en').toLowerCase().slice(0, 2);
  return `${normLang}:${normText}`;
};

const readStore = () => {
  try {
    const raw = localStorage.getItem(CORRECTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  localStorage.setItem(CORRECTIONS_STORAGE_KEY, JSON.stringify(store));
};

/** @returns {Array<{ sourceHeard, corrected, lang, createdAt, key }>} */
export const loadCorrections = () => {
  const store = readStore();
  return Object.values(store).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

/** Upsert by normalized sourceHeard + lang. */
export const saveCorrection = ({ sourceHeard, corrected, lang, createdAt }) => {
  const source = (sourceHeard || '').trim();
  const fix = (corrected || '').trim();
  if (!source || !fix) return null;

  const key = normalizeKey(source, lang);
  const entry = {
    sourceHeard: source,
    corrected: fix,
    lang: (lang || 'en').toLowerCase().slice(0, 2),
    createdAt: createdAt || Date.now(),
    key,
  };

  const store = readStore();
  store[key] = entry;
  writeStore(store);
  return entry;
};

/** Exact normalized match on sourceHeard. */
export const findCorrection = (text, lang) => {
  const key = normalizeKey(text, lang);
  const store = readStore();
  return store[key] || null;
};

export const exportCorrections = () => JSON.stringify(loadCorrections(), null, 2);

/** Merge import; later entries with same key win. */
export const importCorrections = (json) => {
  let items = [];
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    return { imported: 0, total: loadCorrections().length };
  }

  let imported = 0;
  for (const item of items) {
    const saved = saveCorrection(item);
    if (saved) imported += 1;
  }
  return { imported, total: loadCorrections().length };
};

/** Test helper — clears store. */
export const clearCorrections = () => {
  localStorage.removeItem(CORRECTIONS_STORAGE_KEY);
};
