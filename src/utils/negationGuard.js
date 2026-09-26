/**
 * Negation guard (v4.156.0) — a READ-ONLY warning, never a rewrite.
 *
 * "Patient denies chest pain" and "Patient has chest pain" are the same audio
 * to an acoustic model. If the negation is lost, the transcript states the
 * opposite of what the patient said. This is the single most dangerous failure
 * mode in medical interpreting, and the app will NOT guess: auto-inserting
 * "denies" would invent a diagnosis.
 *
 * So the guard only says: "listen again to this line". It never edits a word.
 *
 * Design rule learned the hard way in v4.155.1: an alarm that cries wolf gets
 * ignored, and then it cannot catch the real thing. So the risk patterns are
 * deliberately TIGHT (a bare clinical complaint right after the subject), and
 * the test file carries as many must-NOT-warn sentences as must-warn ones.
 */

const fold = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const langCode = (l) => (l || 'en').toString().toLowerCase().slice(0, 2);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasTerm = (foldedText, term) => {
  const t = fold(term).trim();
  if (!t) return false;
  return new RegExp(`\\b${escapeRe(t).replace(/\s+/g, '\\s+')}\\b`).test(foldedText);
};

/** Tooltip text for the bubble marker. */
export const NEGATION_GAP_TITLE =
  'Possible dropped negation — replay this line. The app flags it, it never guesses the word.';

/** A bare negation cue anywhere in the bubble means it is NOT missing one. */
export const NEGATION_CUES = {
  en: ['no', 'not', 'never', 'none', 'denies', 'deny', 'denied', 'without', 'negative', 'free of'],
  es: ['no', 'niega', 'niegan', 'nunca', 'sin', 'negativo', 'negativa', 'ningun', 'ninguna', 'descarta', 'refiere'],
};

/**
 * Shapes where a missing negation flips the meaning.
 *
 * Precision over recall, deliberately. "He is allergic to penicillin" is a
 * NORMAL affirmative sentence a patient says all day — flagging it would fire
 * constantly during a medical call, and a guard that fires constantly gets
 * muted, and then it cannot catch the real thing. So we only match DEGENERATE
 * shapes: a complaint glued to the subject with no verb at all ("patient chest
 * pain"), or an "any ..." that only makes sense when negated.
 *
 * Consequence, stated honestly: this guard cannot catch every possible dropped
 * negation. The ✎ correction loop and the `probe-negation-dropped` corpus case
 * remain the backstop for the rest.
 */
export const NEGATION_RISKS = {
  en: [
    // A complaint glued to the subject with no verb: "patient chest pain".
    { re: /\b(?:patient|he|she|they)\s+(?:with\s+)?(?:chest\s+pain|difficulty\s+breathing|shortness\s+of\s+breath|fever|nausea|bleeding|dizziness)\b/, expect: 'no / denies / without' },
    // "any ..." only reads as a question when it is negated.
    { re: /\bany\s+(?:chest\s+pain|difficulty\s+breathing|shortness\s+of\s+breath|fever|nausea|bleeding)\b/, expect: 'no / denies / without' },
  ],
  es: [
    { re: /\b(?:paciente|es|son)\s+(?:con\s+)?(?:dolor\s+en\s+el\s+pecho|disnea|dificultad\s+respiratoria|fiebre|n[aá]useas|hemorragia|mareo)\b/, expect: 'no / niega / sin' },
    { re: /\balg[uú]n(?:a)?\s+(?:dificultad\s+respiratoria|dolor|fiebre|sangrado)\b/, expect: 'ninguno / niega / sin' },
  ],
};

/** Does this text contain a negation cue? ("denies", "niega", "no", "sin"…) */
export const hasNegationCue = (text, lang = 'en') => {
  const hay = fold(text);
  if (!hay.trim()) return false;
  return (NEGATION_CUES[langCode(lang)] || []).some((c) => hasTerm(hay, c));
};

/**
 * Report-only: utterances that look like a negation went missing.
 * @returns {{expect:string, snippet:string}[]}
 */
export const findNegationGaps = (text, lang = 'en') => {
  const code = langCode(lang);
  const hay = fold(text);
  if (!hay.trim()) return [];
  const cues = NEGATION_CUES[code] || [];
  if (cues.some((c) => hasTerm(hay, c))) return [];
  return (NEGATION_RISKS[code] || [])
    .filter(({ re }) => re.test(hay))
    .map(({ re, expect }) => ({ expect, snippet: hay.match(re)[0].trim() }));
};

export default findNegationGaps;
