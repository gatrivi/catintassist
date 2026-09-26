/**
 * Negation guard (v4.156.0) — READ-ONLY. It must never edit a word.
 *
 * Note the shape of this file: there are MORE must-NOT-warn sentences than
 * must-warn ones. An alarm that cries wolf gets ignored, and then it cannot
 * catch the real thing (the lesson from the v4.155.1 VANISH bug).
 */
import { findNegationGaps, NEGATION_GAP_TITLE, NEGATION_CUES } from './negationGuard';

/** Degenerate transcripts where a negation looks lost — must warn. */
const MUST_WARN = [
  'Patient chest pain',
  'patient with difficulty breathing',
  'any chest pain',
  'any fever',
  'she dizziness',
];

/** Normal, real sentences — must stay silent, or the operator mutes the guard. */
const MUST_NOT_WARN = [
  'Patient denies chest pain',
  'The patient reports chest pain since Tuesday',
  'She has chest pain radiating to the left arm',
  'He is allergic to penicillin',
  'She is diabetic',
  'His history of diabetes spans ten years',
  'No history of diabetes',
  'The nurse is going to check the blood pressure',
  'Any questions about the discharge instructions?',
  'Call 5551234567 if the fever comes back',
  'She denies shortness of breath',
  'Take one tablet twice daily',
  '',
  '   ',
];

describe('negationGuard v4.156.0', () => {
  test('flags a dropped negation, EN', () => {
    MUST_WARN.forEach((text) => {
      expect({ text, gaps: findNegationGaps(text, 'en').length }).toMatchObject({ gaps: 1 });
    });
  });

  test('NEVER fires on a normal sentence (no crying wolf)', () => {
    MUST_NOT_WARN.forEach((text) => {
      expect({ text, gaps: findNegationGaps(text, 'en') }).toMatchObject({ gaps: [] });
    });
  });

  test('flags a dropped negation, ES', () => {
    ['paciente disnea', 'paciente con dificultad respiratoria', 'alguna dificultad respiratoria'].forEach(
      (text) => {
        expect({ text, gaps: findNegationGaps(text, 'es').length }).toMatchObject({ gaps: 1 });
      },
    );
  });

  test('silent on normal Spanish (an affirmative is not a dropped negation)', () => {
    [
      'Niega dolor en el pecho',
      'Tiene dolor en el pecho desde el martes',
      'Es diabético',
      'Tiene historial de diabetes',
      'Tome una tableta',
    ].forEach((text) => {
      expect({ text, gaps: findNegationGaps(text, 'es') }).toMatchObject({ gaps: [] });
    });
  });

  test('never edits the text — it returns data, not words', () => {
    const text = 'Patient chest pain';
    const gaps = findNegationGaps(text, 'en');
    expect(text).toBe('Patient chest pain'); // untouched, on purpose
    expect(gaps[0]).toEqual({ expect: 'no / denies / without', snippet: 'patient chest pain' });
  });

  test('a single cue anywhere silences the whole bubble', () => {
    expect(findNegationGaps('Patient chest pain, but no fever', 'en')).toEqual([]);
    expect(NEGATION_CUES.en).toContain('denies');
  });

  test('accents are folded before matching (ES)', () => {
    expect(findNegationGaps('paciente con dificultad respiratoria', 'es').length).toBeGreaterThan(0);
    expect(findNegationGaps('ninguna dificultad respiratoria', 'es')).toEqual([]);
  });

  test('unknown language is silent, never a crash', () => {
    expect(findNegationGaps('Patient chest pain', 'zz')).toEqual([]);
    expect(findNegationGaps(null, 'en')).toEqual([]);
  });

  test('the UI tooltip tells the truth: flag, do not guess', () => {
    expect(NEGATION_GAP_TITLE).toMatch(/never guesses/i);
  });
});
