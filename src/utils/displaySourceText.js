/**
 * What the user reads in a bubble, in one pure place (v4.155.0 / v4.156.0).
 *
 * Order matters and is deliberate:
 *   1. a user correction (✎) always wins — a human outranks every lexicon
 *   2. the user's own ✎ corrections store
 *   3. the domain lexicon — ONLY if the operator turned it on
 *
 * `negated` is computed ALWAYS (it is a couple of regexes and it never edits
 * text), because the negation guard is a read-only warning with its own switch:
 * hiding the safe half behind the risky half would be backwards.
 *
 * With both switches off (the default) the text is byte-identical to v4.154.0.
 * That is the promise this file exists to keep.
 */
import { applySttCorrections } from './transcriptCorrections';
import { applyDomainRepair } from './domainLexicon';
import { findNegationGaps } from './negationGuard';

/**
 * @param {{text?:string, lang?:string, userCorrected?:boolean, domainRepairOn?:boolean}} args
 * @returns {{text:string, repairs:object[], negated:object[], reverted:boolean}}
 */
export const resolveDisplayText = ({
  text,
  lang = 'en',
  userCorrected = false,
  domainRepairOn = false,
} = {}) => {
  const raw = typeof text === 'string' ? text : '';
  const nothing = { repairs: [], negated: [], reverted: false };
  // A bubble the human already fixed is a bubble the human vouches for.
  if (userCorrected) return { text: raw, ...nothing };

  const corrected = applySttCorrections(raw, lang);
  if (!domainRepairOn) return { text: corrected, ...nothing, negated: findNegationGaps(corrected, lang) };

  const fixed = applyDomainRepair(corrected, lang);
  return { text: fixed.text, repairs: fixed.repairs, negated: fixed.negated, reverted: fixed.reverted };
};

export default resolveDisplayText;
