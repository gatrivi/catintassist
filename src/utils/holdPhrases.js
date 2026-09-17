/** Hold-phrase detection (v4.125.0) — pure helpers, unit-tested.
 *
 * Waiting-room lines ("please hold", "wait for the provider", ...) arm a
 * hold intent; the SessionContext tick loop engages hold once the line goes
 * quiet. Same matcher ALSO guards auto-resume: hold music/announcements
 * heard WHILE holding must not break hold.
 *
 * Design: STRONG patterns fire on their own; WEAK single words fire only in
 * short transcripts (<=8 words) so "hold your insurance card" can't trigger.
 * False negatives are safe (manual hold button exists); false positives are
 * not — when in doubt, a pattern stays out.
 */

/** Lowercase, strip punctuation + diacritics, collapse whitespace. */
export function normalizeHoldText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9n\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// (hold|hole|holt): "hole/holt" are classic STT mishears of "hold".
const H = '(hold|hole|holt)';

const STRONG_PATTERNS = [
  // — EN: explicit hold —
  `\\bplease ${H}\\b`,
  `\\b${H} please\\b`,
  `\\b${H} on\\b`,
  `\\b${H} the line\\b`,
  `\\b${H} for a (moment|minute|second)\\b`,
  `\\bon ${H}\\b`,
  `\\b(put|puts|putting|place|placed|placing|leave|leaving)\\b.{0,20}\\bon ${H}\\b`,
  '\\bstay on the (line|phone)\\b',
  "\\bdon'?t hang up\\b",
  '\\bdo not hang up\\b',
  // — EN: wait-for-provider family (the user's examples) —
  '\\bwait\\b.{0,24}\\b(provider|doctor|physician|nurse)\\b',
  '\\b(get|fetch|bring) the (doctor|provider|physician|nurse)\\b',
  '\\bdoctor will be\\b',
  '\\bbe right with you\\b',
  '\\bright with you\\b',
  '\\bwith you in\\b',
  '\\bbe right back\\b',
  '\\bbear with me\\b',
  '\\bhang on\\b.{0,16}\\b(moment|minute|second)\\b',
  // — EN: time asks —
  '\\b(one|1|just) (moment|moments|minute|minutes|second|seconds)\\b',
  '\\bgive me\\b.{0,16}\\b(moment|minute|second)\\b',
  // — ES: waiting-room Spanish —
  '\\bun momento\\b',
  '\\bun momentito\\b',
  '\\bun minuto\\b',
  '\\bespere\\b',
  '\\bdeme\\b.{0,16}\\b(momento|minuto)\\b',
  '\\ben seguida\\b',
  '\\bya viene el doctor\\b',
  '\\bel doctor.{0,16}\\bviene\\b',
  '\\bviene en un momento\\b',
  '\\bno (me )?cuelgue\\b',
  '\\b(mantengase|permanezca) en linea\\b',
];

const STRONG_RES = STRONG_PATTERNS.map((p) => ({
  re: new RegExp(p),
  holdWord: p.includes('(hold|hole|holt)'),
}));

// WEAK single words — short transcripts only (STT fragment of the real cue).
// "hold your card / hold on to the paperwork" is handling paper, not holding.
// When present, hold-word patterns are vetoed — but wait/doctor/moment cues
// in the same sentence still fire ("hold your card while I get the doctor").
const WEAK_EXCLUDE = /\bhold (your|on to|onto)\b/;
export const WEAK_MAX_WORDS = 8;

const WEAK_WORDS = ['hold', 'hole', 'holt', 'espere', 'espera', 'esperame', 'momento', 'momentito'];
const WEAK_RES = WEAK_WORDS.map((w) => new RegExp(`\\b${w}\\b`));

const wordCount = (t) => (t ? t.split(' ').length : 0);

/** Returns the matched pattern source, or null. Lane-agnostic on purpose:
 *  both the clinic (EN) and the patient (ES) can signal a hold. */
export function matchHoldPhrase(text) {
  const t = normalizeHoldText(text);
  if (!t) return null;
  const paperWork = WEAK_EXCLUDE.test(t);
  for (const { re, holdWord } of STRONG_RES) {
    if (holdWord && paperWork) continue;
    if (re.test(t)) return re.source;
  }
  if (wordCount(t) <= WEAK_MAX_WORDS && !paperWork) {
    for (const re of WEAK_RES) {
      if (re.test(t)) return re.source;
    }
  }
  return null;
}
