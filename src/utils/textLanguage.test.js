import { guessEnEs, correctSourceLang } from './textLanguage';

const PAIR = { left: 'en', right: 'es' };

describe('guessEnEs (v4.175.0)', () => {
  test('English lines from the 2026-10-15 call read as English', () => {
    expect(guessEnEs("I'm going to enter today's appointment.")).toBe('en');
    expect(guessEnEs('We do have an office in Belvedere. On the 2nd Floor in the Midland State')).toBe('en');
    expect(guessEnEs('And you could go there and use the computer there')).toBe('en');
    expect(guessEnEs('You select add activity.')).toBe(null); // 1 hit only: keep label
  });

  test('Spanish reads as Spanish', () => {
    expect(guessEnEs('Te voy a enseñar cómo hacerlo.')).toBe('es');
    expect(guessEnEs('Bueno, la cita es el martes por la mañana')).toBe('es');
  });

  test('short or mixed text is not overruled', () => {
    expect(guessEnEs('Okay.')).toBe(null);
    expect(guessEnEs('Mhmm.')).toBe(null);
    expect(guessEnEs('')).toBe(null);
  });
});

describe('correctSourceLang', () => {
  test('mislabelled ES bubble with English text translates from EN', () => {
    expect(correctSourceLang('In your Illinois JobLink account no later than 9AM tomorrow.', 'es', PAIR)).toBe('en');
  });
  test('unsure keeps the label', () => {
    expect(correctSourceLang('Okay.', 'es', PAIR)).toBe('es');
  });
  test('non EN/ES pair is never touched', () => {
    expect(correctSourceLang('the you and is', 'pt', { left: 'pt', right: 'fr' })).toBe('pt');
  });
});
