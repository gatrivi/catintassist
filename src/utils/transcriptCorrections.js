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

/** Every pinned glossary entry (sentence or phrase), newest first. */
export const loadGlossary = (sourceLang, targetLang) => {
  const s = normalizeLang(sourceLang);
  const t = normalizeLang(targetLang);
  return loadCorrections()
    .filter((e) => e.kind === CORRECTION_KIND.GLOSSARY)
    .filter((e) => !s || normalizeLang(e.lang) === s)
    .filter((e) => !t || normalizeLang(e.targetLang) === t);
};

const escapeReGloss = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Fold accents + lowercase, so "cánula" matches "canula". */
const foldMatch = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * A pin qualifies as a reusable PHRASE when it is:
 *   - two or more words ("behavioral health"), or
 *   - ONE word of at least MIN_SINGLE_PIN_CHARS characters ("disclosure").
 *
 * Short single words are refused on purpose: pinning "no" or "the" and having it
 * auto-applied inside every future sentence would corrupt real ones. The
 * operator can always pin such a word as a two-word phrase instead, or use the
 * STT lexicon (which is a different, reviewed list).
 */
export const GLOSSARY_MIN_PHRASE_WORDS = 2;
export const GLOSSARY_MIN_SINGLE_PIN_CHARS = 4;

const qualifiesAsPhrase = (source) => {
  const words = source.split(' ').filter(Boolean);
  if (words.length >= GLOSSARY_MIN_PHRASE_WORDS) return true;
  return words.length === 1 && words[0].replace(/[^\p{L}\p{N}]/gu, '').length >= GLOSSARY_MIN_SINGLE_PIN_CHARS;
};

/**
 * v4.161.0 — PHRASE-level glossary.
 *
 * The sentence-exact lookup above only fires on one exact sentence, so in a CSA
 * call you would re-pin every phrasing by hand. Phrase mode lets the interpreter
 * pin a TERM once ("behavioral health" → "salud conductual") and have it apply
 * inside every future sentence.
 *
 * Safety rules, because this rewrites the text the translator receives:
 *  - LONGEST source phrase wins, so a longer pin is never chopped by a shorter
 *    one sitting inside it;
 *  - word-boundary matching, so "referral" cannot fire inside "referrals";
 *  - accents folded, case ignored;
 *  - single-word pins are ignored here (they belong to the STT lexicon, and a
 *    one-word translation pin is far too blunt to auto-apply).
 */
export const applyGlossaryPhrases = (text, sourceLang, targetLang) => {
  const raw = typeof text === 'string' ? text : '';
  const entries = loadGlossary(sourceLang, targetLang)
    .map((e) => ({
      source: (e.sourceHeard || '').trim().replace(/\s+/g, ' '),
      target: (e.corrected || '').trim(),
    }))
    .filter((e) => e.source && e.target && qualifiesAsPhrase(e.source))
    // longest first: the specific pin must beat the general one
    .sort((a, b) => b.source.length - a.source.length);

  if (!entries.length) return { text: raw, applied: [] };

  const applied = [];
  let out = raw;
  for (const { source, target } of entries) {
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeReGloss(foldMatch(source)).replace(/\s+/g, '[\\s\\u00a0]+')}(?![\\p{L}\\p{N}])`,
      'giu',
    );
    if (!re.test(out)) continue; // lastIndex is irrelevant: re is rebuilt each pass
    out = out.replace(re, target);
    applied.push({ from: source, to: target });
  }
  return { text: out, applied };
};

/** Delete one entry by its key. Returns true when something was removed. */
export const removeCorrection = (key) => {
  const store = readStore();
  if (!store[key]) return false;
  delete store[key];
  writeStore(store);
  return true;
};

/** Delete every glossary entry for a language pair. Returns how many went. */
export const clearGlossary = (sourceLang, targetLang) => {
  const store = readStore();
  const doomed = loadGlossary(sourceLang, targetLang).map((e) => e.key);
  doomed.forEach((k) => delete store[k]);
  if (doomed.length) writeStore(store);
  return doomed.length;
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
    // v4.115.0: word-boundary guard — a correction for "an" must not rewrite
    // Susan/Juana, nor "12" inside "555-123-4567". Boundaries only apply
    // where the source starts/ends with a word char.
    const src = entry.sourceHeard || '';
    const left = /^\w/.test(src) ? '\\b' : '';
    const right = /\w$/.test(src) ? '\\b' : '';
    const re = new RegExp(`${left}${escapeRegex(src)}${right}`, 'gi');
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
