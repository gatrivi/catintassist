/**
 * v4.175.0 — which language is this text REALLY in? (EN/ES only)
 *
 * Why: the EN and ES Deepgram sockets both hear the same audio. A bubble opened
 * by the ES socket is labelled "es" even when the words are English. The app
 * then asked "translate es→en" on English text, got the same text back, the
 * passthrough guard rejected it → the bubble showed NO translation.
 *
 * Rule: count common function words of each language. Only overrule the label
 * when the evidence is clear; otherwise return null and keep the label.
 */

// Words that only one language uses. Ambiguous ones (no, a, me, si) left out.
const EN_WORDS = new Set([
  'the', 'you', 'your', 'and', 'is', 'are', 'to', 'of', 'in', 'it', 'that', 'i',
  "i'm", 'we', 'do', 'have', 'can', 'what', 'this', 'my', 'on', 'for', 'with',
  'be', 'not', 'at', 'could', 'would', 'will', 'gonna', 'going', 'okay', 'yes',
  'so', 'there', 'they', 'he', 'she', 'was', 'if', 'just', "don't", "it's",
  "you're", 'how', 'when', 'from', 'but', 'about', 'did', 'need', 'any',
]);
const ES_WORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'por',
  'para', 'con', 'se', 'su', 'lo', 'le', 'mi', 'tu', 'usted', 'está', 'esta',
  'sí', 'pero', 'como', 'muy', 'bien', 'hay', 'tiene', 'qué', 'porque', 'del',
  'al', 'yo', 'eso', 'este', 'ella', 'él', 'nos', 'tengo', 'puede', 'cuando',
  'también', 'ya', 'más', 'bueno', 'pues', 'entonces', 'ahora',
]);
const ES_MARKS = /[ñáéíóú¿¡]/i;

/**
 * @returns {'en'|'es'|null} null = not sure, keep the existing label.
 */
export function guessEnEs(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .split(/[^a-zñáéíóúü']+/i)
    .filter(Boolean);
  if (words.length < 2) return null;
  let en = 0;
  let es = ES_MARKS.test(text) ? 2 : 0;
  for (const w of words) {
    if (EN_WORDS.has(w)) en += 1;
    if (ES_WORDS.has(w)) es += 1;
  }
  // Clear winner only: at least 2 hits AND double the other side.
  if (en >= 2 && en >= es * 2) return 'en';
  if (es >= 2 && es >= en * 2) return 'es';
  return null;
}

/**
 * Source language to translate FROM. Only corrects within an EN/ES pair;
 * any other pair keeps its label untouched.
 */
export function correctSourceLang(text, lang, pair) {
  const sides = [pair?.left, pair?.right].map((l) => String(l || '').slice(0, 2).toLowerCase());
  if (!(sides.includes('en') && sides.includes('es'))) return lang;
  return guessEnEs(text) || lang;
}
