/** v4.105.0 — recordings disk backup naming.
 *  Filename IS the storage key: `greeting_en_morning.webm` ↔ IndexedDB key
 *  `greeting_en_morning`. Export writes it, import reads it back — no dialog,
 *  no guessing, and the same file set works on localhost and the live site.
 */

const MIME_TO_EXT = [
  ['audio/webm', 'webm'],
  ['audio/ogg', 'ogg'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/x-m4a', 'm4a'],
  ['audio/wav', 'wav'],
  ['audio/x-wav', 'wav'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
];

const EXT_TO_MIME = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export const mimeToExt = (type) => {
  const clean = String(type || '').toLowerCase().split(';')[0].trim();
  const hit = MIME_TO_EXT.find(([m]) => m === clean);
  return hit ? hit[1] : 'bin';
};

export const extToMime = (name) => {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return (m && EXT_TO_MIME[m[1]]) || '';
};

/** `greeting_en_morning` + audio/webm Blob → `greeting_en_morning.webm` */
export const fileNameForBlob = (key, blob) => `${String(key)}.${mimeToExt(blob?.type)}`;

/** `greeting_en_morning.webm` → `greeting_en_morning` (strips one extension, any path) */
export const keyFromFileName = (name) =>
  String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .trim();
