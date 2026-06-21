/** Rotating stock backgrounds from public/bg until user uploads bg_app. */

export const DEFAULT_BG_INDEX_KEY = 'catint_default_bg_index_v1';

/** Filenames under public/bg — keep in sync with public/bg on disk. */
export const DEFAULT_BG_FILES = [
  '20180802_233611.jpg',
  '20181108_154616.jpg',
  '20181229_174621.jpg',
  '20191001_125705.jpg',
  '20191007_155933.jpg',
  '20191126_161111.jpg',
  'cb2.jpg',
  'ferret2.jpg',
  'gat_20160808_145837.jpg',
  'gat_20160815_220050.jpg',
  'IMG-20140717-WA0001.jpg',
  'IMG_20211121_133603316.jpg',
  'jak.jpg',
  'Screenshot 2026-01-22 142428.png',
  'snow2.jpg',
  'type.jpg',
  'type2.jpg',
  'will.jpg',
];

export const DEFAULT_BG_FALLBACK = '/bg/default.svg';

export const publicBgUrl = (filename) =>
  `/bg/${encodeURIComponent(filename)}`;

export const readDefaultBgIndex = () => {
  try {
    const n = parseInt(localStorage.getItem(DEFAULT_BG_INDEX_KEY) || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

export const writeDefaultBgIndex = (index) => {
  try {
    localStorage.setItem(DEFAULT_BG_INDEX_KEY, String(index));
  } catch (_) {}
};

/** Current default URL without advancing the rotation pointer. */
export const peekDefaultBackgroundUrl = () => {
  if (!DEFAULT_BG_FILES.length) return DEFAULT_BG_FALLBACK;
  const idx = readDefaultBgIndex() % DEFAULT_BG_FILES.length;
  return publicBgUrl(DEFAULT_BG_FILES[idx]);
};

/** Next default in rotation; advances stored index. */
export const getNextDefaultBackgroundUrl = () => {
  if (!DEFAULT_BG_FILES.length) return DEFAULT_BG_FALLBACK;
  const idx = readDefaultBgIndex() % DEFAULT_BG_FILES.length;
  writeDefaultBgIndex(idx + 1);
  return publicBgUrl(DEFAULT_BG_FILES[idx]);
};

/**
 * Resolve body background: custom IndexedDB blob wins; else rotating public/bg.
 * @param {Blob|null} customBlob from loadFile('bg_app')
 * @param {{ advance?: boolean }} opts advance rotation when picking default (default true)
 */
export const resolveAppBackgroundPath = (customBlob, { advance = true } = {}) => {
  if (customBlob) return null; // caller uses object URL
  return advance ? getNextDefaultBackgroundUrl() : peekDefaultBackgroundUrl();
};
