/** Deepgram Nova-2 general language pair config (Settings + STT + translation). */

export const LANG_PAIR_STORAGE_KEY = 'catint_lang_pair_v1';
export const LANG_PAIR_CHANGED_EVENT = 'cat_lang_pair_changed';

export const DEFAULT_PAIR = { left: 'en', right: 'es' };

/** Nova-2-general codes — grouped for Settings dropdown. */
export const DEEPGRAM_LANGUAGES = [
  { code: 'en', label: 'English', group: 'Common' },
  { code: 'en-US', label: 'English (US)', group: 'English variants' },
  { code: 'en-GB', label: 'English (UK)', group: 'English variants' },
  { code: 'en-AU', label: 'English (Australia)', group: 'English variants' },
  { code: 'en-NZ', label: 'English (New Zealand)', group: 'English variants' },
  { code: 'en-IN', label: 'English (India)', group: 'English variants' },
  { code: 'es', label: 'Spanish', group: 'Common' },
  { code: 'es-419', label: 'Spanish (Latin America)', group: 'Spanish variants' },
  { code: 'fr', label: 'French', group: 'Common' },
  { code: 'fr-CA', label: 'French (Canada)', group: 'French variants' },
  { code: 'de', label: 'German', group: 'Common' },
  { code: 'pt', label: 'Portuguese', group: 'Common' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', group: 'Portuguese variants' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)', group: 'Portuguese variants' },
  { code: 'it', label: 'Italian', group: 'European' },
  { code: 'nl', label: 'Dutch', group: 'European' },
  { code: 'pl', label: 'Polish', group: 'European' },
  { code: 'sv', label: 'Swedish', group: 'European' },
  { code: 'da', label: 'Danish', group: 'European' },
  { code: 'nb', label: 'Norwegian', group: 'European' },
  { code: 'fi', label: 'Finnish', group: 'European' },
  { code: 'cs', label: 'Czech', group: 'European' },
  { code: 'ro', label: 'Romanian', group: 'European' },
  { code: 'hu', label: 'Hungarian', group: 'European' },
  { code: 'ru', label: 'Russian', group: 'Other' },
  { code: 'uk', label: 'Ukrainian', group: 'Other' },
  { code: 'tr', label: 'Turkish', group: 'Other' },
  { code: 'hi', label: 'Hindi', group: 'Other' },
  { code: 'ja', label: 'Japanese', group: 'Asian' },
  { code: 'ko', label: 'Korean', group: 'Asian' },
  { code: 'zh', label: 'Chinese', group: 'Asian' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', group: 'Asian' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', group: 'Asian' },
  { code: 'zh-HK', label: 'Chinese (Hong Kong)', group: 'Asian' },
  { code: 'vi', label: 'Vietnamese', group: 'Asian' },
  { code: 'id', label: 'Indonesian', group: 'Asian' },
  { code: 'th', label: 'Thai', group: 'Asian' },
  { code: 'multi', label: 'Multilingual (auto-detect)', group: 'Special' },
];

const VALID_CODES = new Set(DEEPGRAM_LANGUAGES.map((l) => l.code));

export const getLangLabel = (code) =>
  DEEPGRAM_LANGUAGES.find((l) => l.code === code)?.label || code?.toUpperCase() || '?';

/** Short pill label: EN | ES */
export const formatPairShort = (pair = DEFAULT_PAIR) =>
  `${normalizeLang(pair.left).toUpperCase()} | ${normalizeLang(pair.right).toUpperCase()}`;

/** Base 2-letter code for translation APIs. */
export const normalizeLang = (code) => {
  if (!code) return 'en';
  const base = String(code).toLowerCase().split('-')[0];
  if (base === 'multi') return 'en';
  return base;
};

export const isValidLangCode = (code) => VALID_CODES.has(code);

const sanitizeSide = (code, fallback) =>
  isValidLangCode(code) ? code : fallback;

export const loadLanguagePair = () => {
  try {
    const raw = localStorage.getItem(LANG_PAIR_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PAIR };
    const parsed = JSON.parse(raw);
    const left = sanitizeSide(parsed?.left, DEFAULT_PAIR.left);
    const right = sanitizeSide(parsed?.right, DEFAULT_PAIR.right);
    if (left === right && left !== 'multi') return { ...DEFAULT_PAIR };
    return { left, right };
  } catch {
    return { ...DEFAULT_PAIR };
  }
};

export const saveLanguagePair = (pair) => {
  const left = sanitizeSide(pair?.left, DEFAULT_PAIR.left);
  let right = sanitizeSide(pair?.right, DEFAULT_PAIR.right);
  if (left === right && left !== 'multi') right = left === 'en' ? 'es' : 'en';
  const next = { left, right };
  try {
    localStorage.setItem(LANG_PAIR_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
  try {
    window.dispatchEvent(new CustomEvent(LANG_PAIR_CHANGED_EVENT, { detail: next }));
  } catch (_) {}
  return next;
};

/** US number/phone/filler protections only for EN↔ES (either column order). */
export const isEnEsProtectionMode = (pair = DEFAULT_PAIR) => {
  const a = normalizeLang(pair.left);
  const b = normalizeLang(pair.right);
  return (a === 'en' && b === 'es') || (a === 'es' && b === 'en');
};

export const usesMultiSocket = (pair = DEFAULT_PAIR) =>
  pair.left === 'multi' || pair.right === 'multi';

export const getOppositeLang = (detectedLang, pair = DEFAULT_PAIR) => {
  const norm = normalizeLang(detectedLang);
  const left = normalizeLang(pair.left);
  const right = normalizeLang(pair.right);
  if (norm === left) return right;
  if (norm === right) return left;
  return left === norm ? right : left;
};

/** Right column (interpreter side) when detected lang matches pair.right. */
export const shouldReverseBubble = (detectedLang, pair = DEFAULT_PAIR) =>
  normalizeLang(detectedLang) === normalizeLang(pair.right);

/** Bubble lane storage: en=enFinalized lane A (pair.left), es=lane B (pair.right). */
export const laneSideForLang = (lang, pair = DEFAULT_PAIR) =>
  normalizeLang(lang) === normalizeLang(pair.left) ? 'en' : 'es';

export const langForLaneSide = (side, pair = DEFAULT_PAIR) =>
  side === 'en' ? pair.left : pair.right;

export const isTailRemainderBubble = (cap, pair = DEFAULT_PAIR) => {
  if (!cap || cap.isFinal !== false) return false;
  const side = laneSideForLang(cap.lang, pair);
  const finalized = side === 'en' ? cap.enFinalized : cap.esFinalized;
  const interim = side === 'en' ? cap.enInterim : cap.esInterim;
  return !!(finalized && !interim);
};

/** Grouped options for Settings <select>. */
export const groupedLanguageOptions = () => {
  const groups = {};
  DEEPGRAM_LANGUAGES.forEach((item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });
  return groups;
};
