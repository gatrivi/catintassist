/**
 * Domain lexicon + display-side repair (v4.155.0) — pure, no React, no network.
 *
 * Why: interpreting is ~95% medical EN/ES. Deepgram hears drug names as plain
 * English ("albuterol" -> "all but a roll", "exhibit" -> "exit bit"). The eval
 * harness (src/utils/sttEval.js) measures those misses; this file is the cheap
 * fix for a KNOWN miss, without touching the provider or paying more.
 *
 * Rules of the house, on purpose simple — the whole file should be readable in
 * one sitting, by a tired human at 3am:
 *  1. Only fixes spellings that are literally in the table below. Nothing
 *     clever, no guessing, no fuzzy matching.
 *  2. Never touches a digit. Doses and vitals are untouchable, so a rule with
 *     any digit in it is dropped at load time, AND the final text is checked:
 *     if the digit runs changed, the whole repair is thrown away.
 *  3. If the correct word is already in the bubble, it does nothing
 *     (idempotent, and it never double-corrects "albuterol albuterol").
 *  4. A rule only fires when a context word is nearby ("inhaler", "puff",
 *     "mg" for a drug). "All but a roll" in a non-medical sentence is left alone.
 *  5. It NEVER inserts a missing negation. A dropped "denies" is
 *     indistinguishable from an affirmative statement, so "fixing" it would
 *     invent a diagnosis. Dropped negations are REPORTED (findNegationGaps)
 *     and left for a human.
 *  6. Every repair comes back in `repairs[]` so the caller can log it
 *     (catLog) — auditable and revertible.
 *
 * The table is intentionally short: force-fitting a big list of invented terms
 * is how you corrupt a transcript. Add what the eval actually reports wrong.
 */

// v4.156.0: the negation detector lives in its own module (read-only feature,
// own switch). Imported here because applyDomainRepair reports gaps alongside
// its repairs; re-exported below so older callers keep working. No cycle: the
// guard knows nothing about this file.
import { findNegationGaps } from './negationGuard';

const fold = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();


const langCode = (l) => (l || 'en').toString().toLowerCase().slice(0, 2);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "all but a roll" -> /\ball\s+but\s+a\s+roll\b/gi (whitespace-tolerant). */
const mishearRe = (phrase) =>
  new RegExp(`\\b${escapeRe(fold(phrase).trim()).replace(/\s+/g, '\\s+')}\\b`, 'gi');

/**
 * Word-boundary containment on folded text. "has exhibit" ≡ "has an EXHIBIT,"
 * but "an" must never match inside "Ans" and "mg" not inside "mgdl".
 */
const hasTerm = (foldedText, term) => {
  const t = fold(term).trim();
  if (!t) return false;
  return new RegExp(`\\b${escapeRe(t).replace(/\s+/g, '\\s+')}\\b`).test(foldedText);
};

const digitRuns = (text) => (String(text || '').match(/\d+/g) || []).join('|');


/**
 * The table. `term` is the correct spelling, `mishears` are the ways it is
 * actually heard, `context` are words that must be nearby for the fix to fire.
 * @type {{term:string,lang:string,kind:string,mishears:string[],context:string[]}[]}
 */
export const DOMAIN_REPAIR_RULES = [
  // ── Medical EN: drug names heard as English words ────────────────────────
  { term: 'albuterol', lang: 'en', kind: 'drug', mishears: ['all but a roll', 'all but a role', 'all but the roll'], context: ['inhaler', 'puff', 'nebulizer', 'nebuliser', 'mg', 'asthma', 'bronch'] },
  { term: 'amoxicillin', lang: 'en', kind: 'drug', mishears: ['a mocks ill in', 'a mock sicillin', 'a mox icillin'], context: ['mg', 'capsule', 'antibiotic', 'infection', 'dose', 'day'] },
  { term: 'azithromycin', lang: 'en', kind: 'drug', mishears: ['a zithro mycin', 'a zith romy cin'], context: ['mg', 'tablet', 'antibiotic', 'day', 'dose'] },
  { term: 'ibuprofen', lang: 'en', kind: 'drug', mishears: ['eye bue profen', 'i bue profen', 'eye pro fen'], context: ['mg', 'pain', 'fever', 'tablet', 'dose'] },
  { term: 'acetaminophen', lang: 'en', kind: 'drug', mishears: ['a ce ta minophen', 'acet aminophen', 'a set a minophen'], context: ['mg', 'pain', 'fever', 'tablet', 'dose'] },
  { term: 'metoprolol', lang: 'en', kind: 'drug', mishears: ['met o prolol', 'me to pro lol'], context: ['mg', 'blood pressure', 'heart', 'tablet', 'dose', 'beta'] },
  { term: 'levothyroxine', lang: 'en', kind: 'drug', mishears: ['levo thy roxine', 'le vo thi roxine'], context: ['mcg', 'microgram', 'thyroid', 'tablet', 'dose'] },
  { term: 'furosemide', lang: 'en', kind: 'drug', mishears: ['furo se mide', 'fur os emide', 'furo semide'], context: ['mg', 'tablet', 'diuretic', 'fluid', 'dose', 'leg'] },
  { term: 'insulin', lang: 'en', kind: 'drug', mishears: ['in sulin', 'in soo lin'], context: ['units', 'diabetes', 'sugar', 'glucose', 'injection', 'dose'] },
  { term: 'ondansetron', lang: 'en', kind: 'drug', mishears: ['on dan setron', 'on dan ssetron'], context: ['mg', 'nausea', 'vomit', 'tablet', 'anti'] },
  { term: 'cephalexin', lang: 'en', kind: 'drug', mishears: ['sefa lexin', 'sef a lexin', 'se fal exin'], context: ['mg', 'capsule', 'antibiotic', 'infection', 'day'] },

  // ── Medical EN: clinical terms ──────────────────────────────────────────
  { term: 'anemia', lang: 'en', kind: 'clinical', mishears: ['a nee mia', 'a nee me a'], context: ['blood', 'hemoglobin', 'lab', 'fatigue', 'iron'] },
  { term: 'hemoglobin', lang: 'en', kind: 'clinical', mishears: ['hemo globin', 'he mo globin', 'hemo gl bin'], context: ['blood', 'lab', 'g/dl', 'anemia', 'result'] },
  { term: 'hypertension', lang: 'en', kind: 'clinical', mishears: ['hyper tension', 'hyper tention'], context: ['blood pressure', 'bp', 'medication', 'chronic'] },
  { term: 'diabetes', lang: 'en', kind: 'clinical', mishears: ['di abetes', 'die abetes'], context: ['sugar', 'glucose', 'insulin', 'a1c', 'blood'] },
  { term: 'dyspnea', lang: 'en', kind: 'clinical', mishears: ['dis pnea', 'dysp nea'], context: ['breathing', 'breath', 'chest', 'oxygen', 'shortness'] },
  { term: 'sepsis', lang: 'en', kind: 'clinical', mishears: ['sep sis'], context: ['blood', 'infection', 'culture', 'icu', 'pressure'] },

  // ── Medical ES (half of every medical call) ─────────────────────────────
  { term: 'amoxicilina', lang: 'es', kind: 'drug', mishears: ['a moxic ilina', 'amoxic ilina', 'a moxi clina', 'amoxi clina'], context: ['antibiótico', 'antibiotico', 'mg', 'miligramos', 'dosis', 'cápsula', 'capsula'] },
  { term: 'metformina', lang: 'es', kind: 'drug', mishears: ['metform ina', 'metaformina'], context: ['mg', 'miligramos', 'dosis', 'diabetes', 'azúcar', 'azucar', 'pastilla'] },
  { term: 'insulina', lang: 'es', kind: 'drug', mishears: ['in sulina', 'in so lina'], context: ['unidades', 'diabetes', 'azúcar', 'azucar', 'inyección', 'inyeccion', 'glucosa'] },
  { term: 'ibuprofeno', lang: 'es', kind: 'drug', mishears: ['a ibuprofeno', 'ibuprof eno', 'ibupro feno'], context: ['mg', 'miligramos', 'dosis', 'dolor', 'fiebre', 'pastilla'] },
  { term: 'nebulizador', lang: 'es', kind: 'device', mishears: ['nebulisador'], context: ['nebulización', 'nebulizacion', 'vapor', 'asma', 'broncodilatador', 'mg'] },
  { term: 'disnea', lang: 'es', kind: 'clinical', mishears: ['disn ea', 'dis nea'], context: ['respiración', 'respiracion', 'aire', 'oxígeno', 'oxigeno', 'pecho'] },
  { term: 'hipoglucemia', lang: 'es', kind: 'clinical', mishears: ['hipo glucemia', 'hipo glucia'], context: ['azúcar', 'azucar', 'sangre', 'glucosa', 'insulina'] },

  // ── Legal EN: the 3% slice (bills, insurance, police) ───────────────────
  { term: 'exhibit', lang: 'en', kind: 'legal', mishears: ['exit bit'], context: ['record', 'mark', 'evidence', 'admitted', 'entered'] },
  { term: 'deposition', lang: 'en', kind: 'legal', mishears: ['de position', 'deposicion'], context: ['sworn', 'testimony', 'oath', 'examiner'] },
  { term: 'objection', lang: 'en', kind: 'legal', mishears: ['ob jection', 'objecshun'], context: ['sustained', 'overruled', 'counsel', 'your honor'] },
  { term: 'affidavit', lang: 'en', kind: 'legal', mishears: ['a fi davit', 'afidavit'], context: ['sworn', 'signed', 'notary', 'statement', 'penalty'] },
  { term: 'subpoena', lang: 'en', kind: 'legal', mishears: ['sub poena'], context: ['serve', 'court', 'testify', 'appearance', 'notice'] },
  { term: 'copayment', lang: 'en', kind: 'billing', mishears: ['co payment', 'copay ment'], context: ['insurance', 'plan', 'claim', 'visit', 'dollar'] },
  { term: 'deductible', lang: 'en', kind: 'billing', mishears: ['de ductible', 'deduct able'], context: ['insurance', 'plan', 'out of pocket', 'claim', 'met'] },
  { term: 'coinsurance', lang: 'en', kind: 'billing', mishears: ['co insurance', 'coin surance'], context: ['insurance', 'plan', 'claim', 'percent', 'share'] },
];

/** Only rules that cannot touch a digit are loaded at all. Rule 2 of the house. */
export const SAFE_DOMAIN_REPAIR_RULES = DOMAIN_REPAIR_RULES.filter(
  (r) =>
    !/\d/.test(r.term || '') &&
    Array.isArray(r.mishears) &&
    r.mishears.length > 0 &&
    r.mishears.every((m) => m && !/\d/.test(m)),
);

/**
 * v4.156.0: the negation logic moved to its own module (src/utils/negationGuard.js)
 * because it became a first-class, read-only feature with its own switch. It is
 * re-exported here so existing callers keep working.
 */
export { findNegationGaps } from './negationGuard';

/** Rules for one language, longest mishearing first (so "all but the roll" wins). */
const rulesFor = (lang, rules) =>
  rules
    .filter((r) => langCode(r.lang) === langCode(lang))
    .flatMap((r) => r.mishears.map((m) => ({ ...r, mishear: m })))
    .sort((a, b) => b.mishear.length - a.mishear.length);

/**
 * Repair known medical/legal mishearings in a bubble (v4.155.0).
 *
 * Pure: text in, text out. The caller logs `repairs` (catLog) so every change
 * is auditable, and `reverted: true` means the whole repair was thrown away
 * because it moved a digit — the safety net that makes "never touches digits"
 * true rather than hopeful.
 *
 * @param {string} text
 * @param {string} [lang] 'en' | 'es'
 * @param {{rules?: object[]}} [opts]
 * @returns {{text:string, repairs:{from:string,to:string,kind:string}[], reverted:boolean, negated:{expect:string,snippet:string}[]}}
 */
export const applyDomainRepair = (text, lang = 'en', { rules = SAFE_DOMAIN_REPAIR_RULES } = {}) => {
  const raw = typeof text === 'string' ? text : '';
  const negated = findNegationGaps(raw, lang);
  if (!raw.trim()) return { text: raw, repairs: [], reverted: false, negated };

  let next = raw;
  const repairs = [];
  rulesFor(lang, rules).forEach(({ mishear, term, kind, context }) => {
    const re = mishearRe(mishear);
    if (!re.test(next)) return;
    re.lastIndex = 0; // a /g/ regex remembers lastIndex — always reset before reuse
    // Rule 3: the right word is already there, so this is a second copy of a
    // phrase we already have, not a mishearing.
    if (hasTerm(fold(next), term)) return;
    // Rule 4: no context word nearby -> it is just English, leave it.
    const hay = fold(next);
    if (!(context || []).some((c) => hasTerm(hay, c))) return;
    re.lastIndex = 0;
    next = next.replace(re, term);
    repairs.push({ from: mishear, to: term, kind });
  });

  // Rule 2, enforced: a moved digit voids the whole repair.
  if (digitRuns(next) !== digitRuns(raw)) {
    return { text: raw, repairs: [], reverted: true, negated };
  }
  return { text: next, repairs, reverted: false, negated };
};

export default applyDomainRepair;

