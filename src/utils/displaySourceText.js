/**
 * What the user reads in a bubble, in one pure place (v4.155.0).
 *
 * Order matters and is deliberate:
 *   1. a user correction (✎) always wins — a human outranks every lexicon
 *   2. the user's own ✎ corrections store
 *   3. the domain lexicon — ONLY if the operator turned it on
 *
 * With the switch off (the default) step 3 is skipped and the result is
 * byte-identical to v4.154.0. That is the promise this file exists to keep.
 */
import { applySttCorrections } from './transcriptCorrections';
import { applyDomainRepair } from './domainLexicon';

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
  if (userCorrected) return { text: raw, repairs: [], negated: [], reverted: false };

  const corrected = applySttCorrections(raw, lang);
  if (!domainRepairOn) return { text: corrected, repairs: [], negated: [], reverted: false };

  const fixed = applyDomainRepair(corrected, lang);
  return { text: fixed.text, repairs: fixed.repairs, negated: fixed.negated, reverted: fixed.reverted };
};

export default resolveDisplayText;
