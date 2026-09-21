/**
 * Transcription call fixtures (Deepgram-shaped). Fake PHI only.
 */
import phoneNumber from "./phone-number.json";
import medicationDosage from "./medication-dosage.json";
import dob from "./dob.json";
import address from "./address.json";
import bilingualSwitch from "./bilingual-switch.json";
import lowConfidence from "./low-confidence.json";
import disconnectReconnect from "./disconnect-reconnect.json";
import interimRewrite from "./interim-rewrite.json";
import interimRestart from "./interim-restart.json";

export const TRANSCRIPTION_FIXTURES = {
  "phone-number": phoneNumber,
  "medication-dosage": medicationDosage,
  dob,
  address,
  "bilingual-switch": bilingualSwitch,
  "low-confidence": lowConfidence,
  "disconnect-reconnect": disconnectReconnect,
  // v4.140.0: in-place interim rewrite — the input to the supersede model.
  "interim-rewrite": interimRewrite,
  // v4.141.0: restarted segment that repeats already-finalized text — the input
  // to the restart split (must never land twice inside one line).
  "interim-restart": interimRestart,
};

export const TRANSCRIPTION_FIXTURE_LIST = Object.values(TRANSCRIPTION_FIXTURES);

export function getTranscriptionFixture(id) {
  return TRANSCRIPTION_FIXTURES[id] || null;
}
