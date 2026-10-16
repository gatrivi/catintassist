import { replayFixtureEvents } from './fixtureReplay';

// v4.182.0 — live call 10-16: phone / email / SSN vanished in Spanish.
const fin = (t, start, lang, lane = 'multi') => ({
  atMs: start * 600, lane,
  payload: { type: 'Results', is_final: true, speech_final: true, start,
    channel: { alternatives: [{ transcript: t, languages: [lang], confidence: 0.9, words: [] }] } },
});
const shown = (events) => replayFixtureEvents({ events }).rows.map((r) => r.text).join(' | ');

describe('multi socket: mixed-language bubble keeps every piece', () => {
  test('Spanish lead-in + English-tagged phone', () =>
    expect(shown([fin('Mi número es', 1, 'es'), fin('555 123 4567', 2, 'en')])).toContain('555 123 4567'));
  test('email between two Spanish pieces', () => {
    const out = shown([fin('Mi correo es', 1, 'es'), fin('juan.perez@gmail.com', 2, 'en'), fin('y mi teléfono', 3, 'es')]);
    expect(out).toContain('juan.perez@gmail.com');
    expect(out).toContain('y mi teléfono');
  });
  test('SSN', () =>
    expect(shown([fin('El seguro social es', 1, 'es'), fin('123-45-6789', 2, 'en')])).toContain('123-45-6789'));
  test('a NEW bubble keeps its own language (speaker switch still translates)', () => {
    const { rows } = replayFixtureEvents({ events: [fin('How are you today?', 1, 'en'), fin('Estoy bien, gracias.', 2, 'es')] });
    expect(rows[rows.length - 1].lang).toBe('es');
  });
  test('two-socket mode untouched (lanes are parallel copies there)', () => {
    const out = shown([fin('Mi número es', 1, 'es', 'es'), fin('my number is', 2, 'en', 'en')]);
    expect(out).not.toContain('Mi número es my number is');
  });
});
