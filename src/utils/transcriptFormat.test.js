import {
  consolidateSpelling,
  extractCopyableNames,
  collectCopyableEntities,
  isPlausibleCopyableName,
  formatTranscriptForDisplay,
  formatSpellingText,
  isSpellingBlock,
  splitLongTextAtCommas,
  bubbleTimestampLabel,
} from './transcriptFormat';

describe('consolidateSpelling', () => {
  test('builds word from as-in segments', () => {
    const text = 'S as in Sam, M as in Mary, I as in India, T as in Tom, H as in Henry';
    expect(consolidateSpelling(text, 'en')).toBe('SMITH');
  });

  test('returns null for non-spelling', () => {
    expect(consolidateSpelling('hello world', 'en')).toBeNull();
  });
});

describe('formatTranscriptForDisplay (Phase D)', () => {
  test('keeps spoken spelling paragraph — no newline rewrite', () => {
    const text = 'S as in Sam, M as in Mary, I as in India, T as in Tom, H as in Henry';
    expect(isSpellingBlock(text)).toBe(true);
    expect(formatTranscriptForDisplay(text, 'en')).toBe(text);
    expect(formatTranscriptForDisplay(text, 'en')).not.toContain('\n');
  });

  test('formatSpellingText still available as opt-in stacked layout', () => {
    const text = 'S as in Sam, M as in Mary, I as in India';
    expect(formatSpellingText(text, 'en')).toContain('\n');
  });
});

describe('extractCopyableNames', () => {
  test('finds name after my name is', () => {
    const names = extractCopyableNames('Hi my name is John Smith');
    expect(names[0]?.value).toBe('John Smith');
  });

  test('finds patient name in mid-sentence (plural + comma after is)', () => {
    const names = extractCopyableNames("and the patients name is, Juan Carlos");
    expect(names[0]?.value).toBe('Juan Carlos');
  });

  test('finds Dr name', () => {
    const names = extractCopyableNames('seen by Dr Jane Doe');
    expect(names.some((n) => n.value.includes('Jane'))).toBe(true);
  });

  test('does not treat I\'m sorry as a name', () => {
    expect(extractCopyableNames("I'm sorry, doctor I'm sorry")).toEqual([]);
    expect(extractCopyableNames('I am sorry doctor')).toEqual([]);
  });

  test('weak cue requires Capitalized token', () => {
    expect(extractCopyableNames("I'm maria")).toEqual([]);
    expect(extractCopyableNames("I'm Maria")[0]?.value).toBe('Maria');
  });

  test('strong cue accepts lowercase STT name', () => {
    expect(extractCopyableNames('my name is maria lopez')[0]?.value).toBe('maria lopez');
  });

  // Brief acceptance strings (v4.84.8)
  test("I'm here never becomes a name", () => {
    expect(extractCopyableNames("I'm here")).toEqual([]);
    expect(extractCopyableNames("I'm Here to help")).toEqual([]);
  });

  test('me llamo Josefina produces chip', () => {
    expect(extractCopyableNames('me llamo Josefina')[0]?.value).toBe('Josefina');
    expect(extractCopyableNames('me llamo josefina')[0]?.value).toBe('josefina');
  });

  test('Dr. Perez produces chip', () => {
    expect(extractCopyableNames('seen by Dr. Perez')[0]?.value).toBe('Perez');
  });

  test('finds first/last name labels', () => {
    const names = extractCopyableNames("the patient's first name is John, last name is Smith");
    expect(names.some((n) => n.value === 'John')).toBe(true);
    expect(names.some((n) => n.value === 'Smith')).toBe(true);
  });

  test('mi nombre es Maria Lopez produces chip', () => {
    expect(extractCopyableNames('mi nombre es Maria Lopez')[0]?.value).toBe('Maria Lopez');
  });

  test('soy la intérprete never becomes a name', () => {
    expect(extractCopyableNames('Hola, soy la intérprete')).toEqual([]);
    expect(extractCopyableNames('soy la interprete de hoy')).toEqual([]);
    expect(extractCopyableNames('soy el enfermero')).toEqual([]);
  });

  test('soy Josefina produces chip but soy alérgica does not', () => {
    expect(extractCopyableNames('Soy Josefina')[0]?.value).toBe('Josefina');
    expect(extractCopyableNames('soy alérgica a la penicilina')).toEqual([]);
    expect(extractCopyableNames('Soy Diabética')).toEqual([]);
  });
});

describe('isPlausibleCopyableName', () => {
  test('rejects stopwords', () => {
    expect(isPlausibleCopyableName('sorry')).toBe(false);
    expect(isPlausibleCopyableName('doctor')).toBe(false);
  });
});

describe('collectCopyableEntities', () => {
  test('includes name chip from cue', () => {
    const ents = collectCopyableEntities('my name is Ana', 'en');
    expect(ents.some((e) => e.kind === 'name' && e.value === 'Ana')).toBe(true);
  });

  test('includes Spelled chip from as-in block', () => {
    const text = 'S as in Sam, M as in Mary, I as in India, T as in Tom, H as in Henry';
    const ents = collectCopyableEntities(text, 'en');
    expect(ents.find((e) => e.kind === 'spelling')?.value).toBe('SMITH');
  });
});

// v4.136.0: a comma boundary between two digit groups tears a zip across
// bubbles ("93, 550") and render-time repair can never rejoin it.
describe('splitLongTextAtCommas digit guard', () => {
  const words = (n) => Array(n).fill('palabra').join(' ');

  test('keeps "93, 550" in one chunk at the >40-word boundary', () => {
    const text = `${words(39)} 93, 550, y una cosa mas`;
    const chunks = splitLongTextAtCommas(text, 40);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toMatch(/93, 550/);
    expect(chunks[0]).not.toMatch(/93,\s*$/);
  });

  test('still splits at normal word boundaries', () => {
    const text = `${words(42)}, ${words(5)}`;
    const chunks = splitLongTextAtCommas(text, 40);
    expect(chunks.length).toBe(2);
    expect(chunks[1]).toBe(words(5));
  });
});

// v4.150.0: hover timestamp — local for hold math, catLog format for log correlation.
describe('bubbleTimestampLabel', () => {
  test('formats local HH:MM:SS and catLog HH:MM:SS.mmm (UTC)', () => {
    const ms = Date.UTC(2026, 8, 25, 14, 32, 7, 123);
    const ts = bubbleTimestampLabel(ms);
    expect(ts).not.toBeNull();
    expect(ts.log).toBe('14:32:07.123');
    expect(ts.local).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  test('falls back to turn-<ms> id for pre-createdAt persisted bubbles', () => {
    const ms = Date.UTC(2026, 8, 25, 9, 5, 3, 400);
    expect(bubbleTimestampLabel(undefined, `turn-${ms}`).log).toBe('09:05:03.400');
  });

  test('returns null when nothing usable is present', () => {
    expect(bubbleTimestampLabel(undefined, undefined)).toBeNull();
    expect(bubbleTimestampLabel(NaN, 'turn-notanumber')).toBeNull();
  });
});
