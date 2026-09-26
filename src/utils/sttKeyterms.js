/**
 * Deepgram keyterm biasing (v4.157.0) + corrections feedback (v4.158.0) — OFF.
 *
 * What this is: telling the model "these words are common in this domain, listen
 * for them". Deepgram supports `keyterm` on Nova-3, and its own guidance is
 * 20–50 terms with a hard 500-token cap.
 *
 * Where the list comes from, and why: from words this app has ALREADY been
 * shown to get wrong. Two sources, in priority order:
 *
 *   1. the user's own ✎ corrections (v4.158.0) — the strongest signal that
 *      exists, because a human typed the right word. Gated behind its own
 *      switch: nothing the operator said ever leaves the machine silently.
 *   2. the domain lexicon — "all but a roll" -> albuterol.
 *
 * We never bias toward a word we merely *expect* to be common. Force-fitting
 * invented terms is Deepgram's documented failure mode, and the eval watches for
 * exactly that: a term that appears when the reference has none is reported as
 * `INVENTED terms`.
 *
 * Budget: capped at KEYTERM_MAX_TERMS and a token budget, human corrections
 * first, then medical kinds, because ~95% of a real day is medical and a
 * deposition must not crowd out a dose.
 */
import { DOMAIN_REPAIR_RULES } from './domainLexicon';

/** Deepgram's guidance is 20–50; stay well inside it. */
export const KEYTERM_MAX_TERMS = 30;

/** Deepgram's documented hard cap for keyterm tokens. */
export const KEYTERM_TOKEN_BUDGET = 500;

/** Medical first — it is ~95% of the day. Then the legal 3%. */
const KIND_PRIORITY = { drug: 0, device: 1, clinical: 2, legal: 3, billing: 4 };

const langCode = (l) => (l || 'en').toString().toLowerCase().slice(0, 2);

/** How many tokens this term costs in the request. */
const tokenCost = (term) => String(term).trim().split(/\s+/).length;

/**
 * v4.158.0 — keyterms harvested from the operator's ✎ corrections.
 *
 * A correction is the one piece of ground truth this app owns: a human heard
 * "all but a roll", decided the drug was albuterol, and typed it. That is far
 * stronger evidence than anything we can guess.
 *
 * Safety rules, because this list is sent to a third party:
 *   - only the CORRECTED text goes out (never what was misheard — sending
 *     "all but a roll" as a keyterm would teach the model the error)
 *   - a single word, or at most a short hyphenated/2-word name; a whole sentence
 *     correction is not a vocabulary item
 *   - letters only: a correction containing a digit is a dose, and doses are
 *     never keyterms
 *
 * @param {{sourceHeard?:string, corrected?:string, lang?:string, createdAt?:number}[]} corrections
 * @param {{max?:number}} [opts]
 * @returns {string[]}
 */
export const keytermsFromCorrections = (corrections = [], { max = 10 } = {}) => {
  const counted = new Map();
  (corrections || []).forEach((entry) => {
    if (!entry?.corrected) return;
    const lang = langCode(entry.lang);
    const term = String(entry.corrected).trim().replace(/\s+/g, ' ');
    if (!term) return;
    // letters only, at most two words: a sentence is not a vocabulary item
    if (/\d/.test(term)) return;
    if (!/^[\p{L}][\p{L}\s'-]*$/u.test(term)) return;
    if (term.split(' ').length > 2) return;
    if (term.length > 40) return;
    const key = `${lang}::${term.toLowerCase()}`;
    const prev = counted.get(key);
    // Frequency first, then most recent: a word fixed often is a real problem.
    counted.set(key, {
      lang,
      term,
      hits: (prev?.hits || 0) + 1,
      last: Math.max(prev?.last || 0, entry.createdAt || 0),
    });
  });
  return [...counted.values()]
    .sort((a, b) => b.hits - a.hits || b.last - a.last || a.term.localeCompare(b.term))
    .slice(0, max)
    .map((e) => e.term);
};

/**
 * The short, high-precision keyterm list for one lane.
 * Deterministic order, so the URL is stable and testable.
 *
 * @param {string} lang
 * @param {{max?:number, tokenBudget?:number, corrections?:object[]}} [opts]
 * @returns {string[]}
 */
export const buildKeyterms = (
  lang,
  { max = KEYTERM_MAX_TERMS, tokenBudget = KEYTERM_TOKEN_BUDGET, corrections = [] } = {},
) => {
  const code = langCode(lang);
  const candidates = DOMAIN_REPAIR_RULES.filter((r) => langCode(r.lang) === code);
  // Unknown lane -> no lexicon terms. Silence is the safe answer: we do not know
  // what language this is, and English terms in a foreign stream force-fit.
  const lexiconTerms = candidates.length
    ? candidates
        .map((r) => ({ term: r.term.trim(), kind: r.kind }))
        .filter((r, i, arr) => arr.findIndex((o) => o.term.toLowerCase() === r.term.toLowerCase()) === i)
        .sort(
          (a, b) =>
            (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9) ||
            a.term.localeCompare(b.term),
        )
        .map((r) => r.term)
    : [];

  // v4.158.0: human corrections outrank the shipped lexicon, but only the ones
  // belonging to THIS lane ever reach this socket.
  const fromCorrections = keytermsFromCorrections(
    (corrections || []).filter((c) => langCode(c?.lang) === code),
    { max },
  );

  const out = [];
  let tokens = 0;
  for (const term of [...fromCorrections, ...lexiconTerms]) {
    if (out.length >= max) break;
    if (out.some((t) => t.toLowerCase() === term.toLowerCase())) continue;
    const cost = tokenCost(term);
    if (tokens + cost > tokenBudget) continue; // skip a fat term, keep the rest
    out.push(term);
    tokens += cost;
  }
  return out;
};

/** Total token cost of a keyterm list — surfaced in Settings so it is never a mystery. */
export const keytermTokenCost = (terms = []) =>
  terms.reduce((a, t) => a + tokenCost(t), 0);

export default buildKeyterms;
