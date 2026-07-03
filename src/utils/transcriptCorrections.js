/** User transcript + translation corrections — local-first glossary — v4.76.0 */

export const CORRECTIONS_STORAGE_KEY = 'catint_corrections_v1';
export const CORRECTIONS_CHANGED_EVENT = 'catint_corrections_changed';

export const CORRECTION_KIND = {
  STT: 'stt',
  GLOSSARY: 'glossary',
};

const normalizeText = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeLang = (lang) => (lang || 'en').toLowerCase().slice(0, 2);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const makeSttKey = (text, lang) => `${normalizeLang(lang)}:${normalizeText(text)}`;

const makeGlossaryKey = (sourceText, sourceLang, targetLang) =>
  `gl:${normalizeLang(sourceLang)}:${normalizeLang(targetLang)}:${normalizeText(sourceText)}`;

const emitChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent(CORRECTIONS_CHANGED_EVENT));
  } catch (_) {}
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
  emitChanged();
};

/** @returns {Array<{ sourceHeard, corrected, lang, kind, targetLang?, createdAt, key }>} */
export const loadCorrections = () => {
  const store = readStore();
  return Object.values(store)
    .map((e) => ({ kind: CORRECTION_KIND.STT, ...e }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

const loadSttEntries = (lang) =>
  loadCorrections().filter(
    (e) => (e.kind === CORRECTION_KIND.STT || !e.kind) && normalizeLang(e.lang) === normalizeLang(lang),
  );

/** Upsert STT or glossary entry. */
export const saveCorrection = ({
  sourceHeard,
  corrected,
  lang,
  kind = CORRECTION_KIND.STT,
  targetLang,
  createdAt,
}) => {
  const source = (sourceHeard || '').trim();
  const fix = (corrected || '').trim();
  if (!source || !fix) return null;

  const entry =
    kind === CORRECTION_KIND.GLOSSARY
      ? {
          sourceHeard: source,
          corrected: fix,
          lang: normalizeLang(lang),
          targetLang: normalizeLang(targetLang),
          kind: CORRECTION_KIND.GLOSSARY,
          createdAt: createdAt || Date.now(),
          key: makeGlossaryKey(source, lang, targetLang),
        }
      : {
          sourceHeard: source,
          corrected: fix,
          lang: normalizeLang(lang),
          kind: CORRECTION_KIND.STT,
          createdAt: createdAt || Date.now(),
          key: makeSttKey(source, lang),
        };

  const store = readStore();
  store[entry.key] = entry;
  writeStore(store);
  return entry;
};

/** Exact normalized STT match on full string. */
export const findCorrection = (text, lang) => {
  const key = makeSttKey(text, lang);
  const store = readStore();
  const hit = store[key];
  if (!hit || hit.kind === CORRECTION_KIND.GLOSSARY) return null;
  return hit;
};

/** Exact glossary match for full source sentence. */
export const findGlossaryTranslation = (sourceText, sourceLang, targetLang) => {
  const key = makeGlossaryKey(sourceText, sourceLang, targetLang);
  const store = readStore();
  return store[key] || null;
};

/** Replace known misheard phrases (longest first, case-insensitive). */
export const applySttCorrections = (text, lang) => {
  const raw = (text || '').trim();
  if (!raw) return raw;

  const exact = findCorrection(raw, lang);
  if (exact) return exact.corrected;

  let out = raw;
  const entries = loadSttEntries(lang)
    .filter((e) => e.sourceHeard.length >= 3)
    .sort((a, b) => b.sourceHeard.length - a.sourceHeard.length);

  for (const entry of entries) {
    const re = new RegExp(escapeRegex(entry.sourceHeard), 'gi');
    out = out.replace(re, entry.corrected);
  }
  return out;
};

/** Apply phrase-level glossary replacements to a machine translation. */
export const applyGlossaryToTranslation = (translation) => {
  const out = (translation || '').trim();
  if (!out) return out;
  // Full-sentence glossary hits are handled via findGlossaryTranslation in useTranslate.
  return out;
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
