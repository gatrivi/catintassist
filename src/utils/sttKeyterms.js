/**
 * Deepgram keyterm biasing (v4.157.0) — OFF by default.
 *
 * What this is: telling the model "these words are common in this domain, listen
 * for them". Deepgram supports `keyterm` on Nova-3, and its own guidance is
 * 20–50 terms with a hard 500-token cap.
 *
 * Where the list comes from, and why: ONLY from terms the app has already been
 * shown to get wrong (src/utils/domainLexicon.js — "all but a roll" → albuterol).
 * We never invent a list of words we merely *expect* to be common. Force-fitting
 * invented terms is Deepgram's documented failure mode, and the eval watches for
 * exactly that: a term that appears when the reference has none is reported as
 * `INVENTED terms`.
 *
 * Budget: capped at KEYTERM_MAX_TERMS and a token budget, medical kinds first,
 * because ~95% of a real day is medical and a deposition must not crowd out a
 * dose.
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
 * The short, high-precision keyterm list for one lane.
 * Deterministic order, so the URL is stable and testable.
 *
 * @param {string} lang
 * @param {{max?:number, tokenBudget?:number}} [opts]
 * @returns {string[]}
 */
export const buildKeyterms = (
  lang,
  { max = KEYTERM_MAX_TERMS, tokenBudget = KEYTERM_TOKEN_BUDGET } = {},
) => {
  const code = langCode(lang);
  const candidates = DOMAIN_REPAIR_RULES.filter((r) => langCode(r.lang) === code);
  // Unknown lane -> no bias at all. Sending English medical terms into a stream
  // we do not recognise is how you force-fit English words into a foreign
  // sentence. Silence is the safe answer.
  if (!candidates.length) return [];
  const ranked = candidates
    .map((r) => ({ term: r.term.trim(), kind: r.kind }))
    // de-dupe on the term itself (a word may appear under two kinds)
    .filter((r, i, arr) => arr.findIndex((o) => o.term.toLowerCase() === r.term.toLowerCase()) === i)
    .sort(
      (a, b) =>
        (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9) ||
        a.term.localeCompare(b.term),
    );

  const out = [];
  let tokens = 0;
  for (const { term } of ranked) {
    if (out.length >= max) break;
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
