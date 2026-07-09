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

export const TRANSCRIPTION_FIXTURES = {
  "phone-number": phoneNumber,
  "medication-dosage": medicationDosage,
  dob,
  address,
  "bilingual-switch": bilingualSwitch,
  "low-confidence": lowConfidence,
  "disconnect-reconnect": disconnectReconnect,
};

export const TRANSCRIPTION_FIXTURE_LIST = Object.values(TRANSCRIPTION_FIXTURES);

export function getTranscriptionFixture(id) {
  return TRANSCRIPTION_FIXTURES[id] || null;
}
