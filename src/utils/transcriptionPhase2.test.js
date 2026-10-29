import { replayFixtureEvents } from './fixtureReplay';

const ev = (atMs, start, transcript, isFinal) => ({
  atMs,
  lane: 'en',
  payload: {
    type: 'Results', is_final: isFinal, speech_final: false, start, duration: 1,
    channel: { alternatives: [{ transcript, confidence: 0.95,
      words: transcript.split(' ').map((w) => ({ word: w, confidence: 0.95 })) }] },
  },
});
const texts = (rows) => rows.map((r) => r.text).join(' || ');

test('fault 1: a growing number no longer freezes the bubble', () => {
  const { rows } = replayFixtureEvents({ events: [
    ev(0, 1, 'I am 4', false),
    ev(200, 1, 'I am 45 years old and I live in Texas', false),
    ev(400, 1, 'I am 45 years old and I live in Texas.', true),
  ] });
  expect(texts(rows)).toContain('Texas');
});

describe('fault 2: multi language = word vote', () => {
  // eslint-disable-next-line global-require
  const { multiLangOf } = require('./applyDeepgramTranscriptPayload');
  const pay = (words, languages) => ({ channel: { alternatives: [{ transcript: 'x', languages,
    words: words.map(([word, language]) => ({ word, language })) }] } });

  test('Spanish sentence opening with OK → es, even if languages[0] is en', () =>
    expect(multiLangOf(pay([['ok', 'en'], ['me', 'es'], ['duele', 'es'], ['la', 'es'], ['cabeza', 'es']], ['en', 'es']))).toBe('es'));
  test('digits do not vote', () =>
    expect(multiLangOf(pay([['mi', 'es'], ['número', 'es'], ['555', 'en'], ['123', 'en'], ['4567', 'en']], ['en', 'es']))).toBe('es'));
  test('tie / no tags → old order', () => {
    expect(multiLangOf(pay([['ok', 'en'], ['sí', 'es']], ['es', 'en']))).toBe('es');
    expect(multiLangOf(pay([], undefined), 'en')).toBe('en');
  });
});

describe('fault 4: repeated words across a pause are real speech', () => {
  const fin = (atMs, start, duration, transcript) => {
    const e = ev(atMs, start, transcript, true);
    e.payload.duration = duration;
    return e;
  };
  test('new audio keeps "the doctor" twice', () => {
    const { rows } = replayFixtureEvents({ events: [
      fin(0, 1, 1.5, 'I need to see the doctor'),
      fin(600, 2.5, 2, 'the doctor said I need to come back'),
    ] });
    expect(texts(rows)).toContain('the doctor the doctor said');
  });
  test('no timing (old payloads) → old overlap guard unchanged', () => {
    const { rows } = replayFixtureEvents({ events: [
      ev(0, 1, 'I need to see the doctor', true),
      ev(600, 3, 'the doctor said I need to come back', true),
    ].map((e) => { delete e.payload.duration; return e; }) });
    expect(texts(rows)).not.toContain('the doctor the doctor');
  });
});

test('fault 1b: a changed number holds, but never hides a paragraph', () => {
  const { rows } = replayFixtureEvents({ events: [
    ev(0, 1, 'call me at 555 123 4567', false),
    ev(200, 1, 'call me at 555 123 4568', false),
    ev(400, 1, 'call me at 555 123 4568 after five because I work all morning', false),
  ] });
  expect(texts(rows)).toContain('all morning');
});
