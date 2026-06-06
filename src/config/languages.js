/** Language tiers for STT (Deepgram nova-2) and translation. */

export const DEFAULT_LANG_PAIR = { source: 'en', target: 'es' };

export const FULL_SUPPORT_LANGS = [
  { code: 'en', label: 'English', short: 'ENG', flag: '🇺🇸', stt: 'en', translate: 'en' },
  { code: 'es', label: 'Spanish', short: 'SPA', flag: '🇪🇸', stt: 'es', translate: 'es' },
];

export const PARTIAL_SUPPORT_LANGS = [
  { code: 'pt', label: 'Portuguese', short: 'POR', flag: '🇧🇷', stt: 'pt', translate: 'pt', sttOk: true, transOk: true },
  { code: 'ru', label: 'Russian', short: 'RUS', flag: '🇷🇺', stt: 'ru', translate: 'ru', sttOk: true, transOk: true },
  { code: 'zh', label: 'Chinese', short: 'ZHO', flag: '🇨🇳', stt: 'zh', translate: 'zh', sttOk: true, transOk: true },
  { code: 'fr', label: 'French', short: 'FRA', flag: '🇫🇷', stt: 'fr', translate: 'fr', sttOk: true, transOk: true },
  { code: 'de', label: 'German', short: 'DEU', flag: '🇩🇪', stt: 'de', translate: 'de', sttOk: true, transOk: true },
  { code: 'it', label: 'Italian', short: 'ITA', flag: '🇮🇹', stt: 'it', translate: 'it', sttOk: true, transOk: true },
  { code: 'ja', label: 'Japanese', short: 'JPN', flag: '🇯🇵', stt: 'ja', translate: 'ja', sttOk: true, transOk: true },
  { code: 'ko', label: 'Korean', short: 'KOR', flag: '🇰🇷', stt: 'ko', translate: 'ko', sttOk: true, transOk: true },
  { code: 'ar', label: 'Arabic', short: 'ARA', flag: '🇸🇦', stt: 'ar', translate: 'ar', sttOk: true, transOk: false },
  { code: 'hi', label: 'Hindi', short: 'HIN', flag: '🇮🇳', stt: 'hi', translate: 'hi', sttOk: true, transOk: false },
  { code: 'la', label: 'Latin', short: 'LAT', flag: '🏛️', stt: 'la', translate: 'la', sttOk: true, transOk: false },
];

export const ALL_LANGS = [...FULL_SUPPORT_LANGS, ...PARTIAL_SUPPORT_LANGS];

export const getLang = (code) => ALL_LANGS.find((l) => l.code === code) || FULL_SUPPORT_LANGS[0];

export const getLangShort = (code) => getLang(code).short;

export const isDefaultPair = (pair) =>
  pair?.source === DEFAULT_LANG_PAIR.source && pair?.target === DEFAULT_LANG_PAIR.target;

export const toDeepgramCode = (code) => getLang(code).stt;

export const toTranslateCode = (code) => getLang(code).translate;
