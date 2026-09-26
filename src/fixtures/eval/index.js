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
import pipelineMedicalAllergies from './pipeline-medical-allergies.json';
import pipelineMedicalDischarge from './pipeline-medical-discharge.json';
import pipelineMedicalDosisEs from './pipeline-medical-dosis-es.json';
import pipelineLegalDeposition from './pipeline-legal-deposition.json';
import pipelineLegalObjection from './pipeline-legal-objection.json';
import pipelineLegalInsuranceDenial from './pipeline-legal-insurance-denial.json';
import pipelineLegalPoliceStatement from './pipeline-legal-police-statement.json';
import pipelineRepairDrugName from './pipeline-repair-drug-name.json';
import pipelineRepairLegalExhibit from './pipeline-repair-legal-exhibit.json';
import probeDrugName from './probe-drug-name-mangling.json';
import probeNegationDropped from './probe-negation-dropped.json';
import probeNegationDroppedEs from './probe-negation-dropped-es.json';
import probeLegalVerb from './probe-legal-verb-confusion.json';
import probeDoseSwap from './probe-dose-swap.json';

/**
 * The day is ~95% medical EN/ES. The corpus is deliberately broader than the
 * day (legal must stay measured, it is 3% not 0%), but the headline number is
 * weighted by KIND_MIX_WEIGHT in src/utils/sttEval.js so depositions do not
 * outvote a dose.
 */
export const EVAL_CASES = [
  // Medical EN — the bulk of the day.
  pipelineMedicalDosage,
  pipelineMedicalNegation,
  pipelineMedicalVitals,
  pipelineMedicalAllergies,
  pipelineMedicalDischarge,
  // Medical ES — the other half of every medical call.
  pipelineMedicalNegationEs,
  pipelineMedicalDosisEs,
  // The 3% slice: bills, insurance, police.
  pipelineLegalDeposition,
  pipelineLegalObjection,
  pipelineLegalInsuranceDenial,
  pipelineLegalPoliceStatement,
  // Cases the domain lexicon is expected to actually fix (v4.155.0).
  pipelineRepairDrugName,
  pipelineRepairLegalExhibit,
  // Informational text probes of known failure shapes (never gated).
  probeDrugName,
  probeNegationDropped,
  probeNegationDroppedEs,
  probeLegalVerb,
  probeDoseSwap,
];

/** Cases that gate the build (they assert OUR pipeline, not the provider). */
export const GATED_EVAL_CASES = EVAL_CASES.filter((c) => c.expect);
