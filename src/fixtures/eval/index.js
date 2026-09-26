/**
 * STT eval corpus (v4.154.0).
 *
 * Two kinds of case, and the difference matters:
 *  - `events` (Deepgram-shaped) → replayed through the REAL live pipeline, so we
 *    can gate on "our app does not damage correct provider text" (damage ≤ 0).
 *    These carry `expect` thresholds and are gated.
 *  - `hypothesis` only → a text probe of a known failure shape (a drug name
 *    mangled, a dropped negation). Reported, never gated: our synthetic
 *    hypotheses are not real Deepgram output, so they must not decide a build.
 */
import pipelineMedicalDosage from './pipeline-medical-dosage.json';
import pipelineMedicalNegation from './pipeline-medical-negation.json';
import pipelineMedicalVitals from './pipeline-medical-vitals.json';
import pipelineMedicalNegationEs from './pipeline-medical-negation-es.json';
import pipelineLegalDeposition from './pipeline-legal-deposition.json';
import pipelineLegalObjection from './pipeline-legal-objection.json';
import probeDrugName from './probe-drug-name-mangling.json';
import probeNegationDropped from './probe-negation-dropped.json';
import probeLegalVerb from './probe-legal-verb-confusion.json';
import probeDoseSwap from './probe-dose-swap.json';

export const EVAL_CASES = [
  pipelineMedicalDosage,
  pipelineMedicalNegation,
  pipelineMedicalVitals,
  pipelineMedicalNegationEs,
  pipelineLegalDeposition,
  pipelineLegalObjection,
  probeDrugName,
  probeNegationDropped,
  probeLegalVerb,
  probeDoseSwap,
];

/** Cases that gate the build (they assert OUR pipeline, not the provider). */
export const GATED_EVAL_CASES = EVAL_CASES.filter((c) => c.expect);
