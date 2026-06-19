/** Medical term priority helpers — v4.56.0 handoff stub.
 * Pure functions only; wire into useDeepgram/useTranslate in a later phase.
 */

export const MEDICAL_TERMS_EN = [
  'hypertension',
  'diabetes',
  'insulin',
  'metformin',
  'anemia',
  'hemoglobin',
  'dialysis',
  'nebulizer',
  'asthma',
  'pneumonia',
];

export const MEDICAL_TERMS_ES = [
  'hipertension',
  'diabetes',
  'insulina',
  'metformina',
  'anemia',
  'hemoglobina',
  'dialisis',
  'nebulizador',
  'asma',
  'neumonia',
];

const normalizeToken = (token) =>
  (token || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const lexiconForLang = (lang) => {
  const code = (lang || 'en').toLowerCase().slice(0, 2);
  return code === 'es' ? MEDICAL_TERMS_ES : MEDICAL_TERMS_EN;
};

/** Higher score = prefer this token reading in ambiguous STT context. */
export const scoreTermPriority = (token, lang = 'en', context = '') => {
  const norm = normalizeToken(token);
  if (!norm) return 0;

  const lexicon = lexiconForLang(lang);
  let score = lexicon.includes(norm) ? 10 : 0;

  const ctx = normalizeToken(context);
  if (score > 0 && ctx) {
    const clinicalHints = ['mg', 'dose', 'patient', 'paciente', 'medication', 'medicamento', 'blood', 'sangre'];
    if (clinicalHints.some((h) => ctx.includes(h))) score += 5;
  }

  return score;
};

/** Post-process hook — returns text unchanged until lexicon replacement rules are added. */
export const applyMedicalBias = (text, lang = 'en') => {
  if (!text || !text.trim()) return text || '';
  const words = text.split(/\s+/);
  const biased = words.map((word) => {
    const stripped = word.replace(/^[^\w]+|[^\w]+$/g, '');
    if (scoreTermPriority(stripped, lang, text) >= 10) return word;
    return word;
  });
  return biased.join(' ');
};
