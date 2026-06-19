import { scoreTermPriority, applyMedicalBias, MEDICAL_TERMS_EN } from './medicalTermLexicon';

describe('medicalTermLexicon v4.56', () => {
  test('clinical EN term scores higher than random word', () => {
    expect(scoreTermPriority('hypertension', 'en')).toBeGreaterThan(scoreTermPriority('hello', 'en'));
  });

  test('clinical context boosts score', () => {
    const base = scoreTermPriority('insulin', 'en', 'patient dose');
    const plain = scoreTermPriority('insulin', 'en', '');
    expect(base).toBeGreaterThan(plain);
  });

  test('applyMedicalBias preserves text (stub phase)', () => {
    const input = 'Patient has hypertension today';
    expect(applyMedicalBias(input, 'en')).toBe(input);
  });

  test('seed lexicon has entries', () => {
    expect(MEDICAL_TERMS_EN.length).toBeGreaterThanOrEqual(10);
  });
});
