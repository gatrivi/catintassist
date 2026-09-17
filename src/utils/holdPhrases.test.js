import { normalizeHoldText, matchHoldPhrase, WEAK_MAX_WORDS } from './holdPhrases';

/** v4.125.0 — hold-phrase matcher: waiting-room cues fire, medical talk doesn't. */
describe('normalizeHoldText', () => {
  test('lowercases, strips punctuation + accents, collapses space', () => {
    expect(normalizeHoldText('¡Un MOMENTO, por favor!')).toBe('un momento por favor');
    expect(normalizeHoldText('Manténgase  en   línea.')).toBe('mantengase en linea');
    expect(normalizeHoldText('')).toBe('');
  });
});

describe('matchHoldPhrase — STRONG positives', () => {
  const cases = [
    // pre-existing behavior (moved, not changed)
    'Stay on the line please',
    'Please hold.',
    'Hold please!',
    'Can I put you on hold?',
    'One moment.',
    'Give me one minute',
    'Interpreter, please hold',
    // user's examples
    'Please wait for the provider, she will be with you shortly',
    'The doctor will be in in just a minute',
    'Just hold.',
    // EN family
    'Hold on a second',
    'Please hold the line',
    'Hold for a moment while I check',
    'The doctor will be right with you',
    'I will be right with you',
    'I will be with you in just a minute',
    'Please bear with me',
    'Please do not hang up',
    'I will be right back',
    'Hang on one moment',
    // STT mishears of hold (context-bound only)
    'Please hole the line',
    // ES
    'Un momento por favor',
    'Espere, ya viene el doctor',
    'En seguida le atiendo',
    'No me cuelgue por favor',
    'El doctor viene en un momento',
    'Manténgase en línea',
    // paperwork veto loses to a real wait cue in the same sentence
    'Hold your card while I get the doctor',
  ];
  test.each(cases)('fires: %s', (line) => {
    expect(matchHoldPhrase(line)).not.toBeNull();
  });
});

describe('matchHoldPhrase — WEAK short-fragment positives', () => {
  test.each([
    'hold',
    'Hold.',
    'One sec— hold',
    'espere',
    'momentito',
  ])('fires: %s', (line) => {
    expect(matchHoldPhrase(line)).not.toBeNull();
  });
  test(`weak cap is ${WEAK_MAX_WORDS} words`, () => {
    expect(WEAK_MAX_WORDS).toBe(8);
  });
});

describe('matchHoldPhrase — negatives (must NEVER fire)', () => {
  const cases = [
    // medical talk containing hold-ish substrings
    'Any bowel movement in the last day',
    'Fetal movement is normal',
    'The shoulder pain started yesterday',
    'We need to withhold treatment for now',
    'The whole minute felt like an hour',
    'The holder for your insurance card',
    'Household contacts should also test',
    'Please behold the results', // boundary discipline
    // "hold your X" = handling paper, not holding the line
    'Please hold your insurance card ready for the receptionist today',
    'Hold on to the paperwork until the nurse calls your name twice',
    // ordinary intake
    'My date of birth is March fifth nineteen eighty',
    'The pharmacy number is five five five zero one two three',
    '',
  ];
  test.each(cases)('silent: %s', (line) => {
    expect(matchHoldPhrase(line)).toBeNull();
  });
});
