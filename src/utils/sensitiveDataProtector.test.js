// sensitiveDataProtector.test.js  (Jest / Vitest compatible)
// Run: npx vitest sensitiveDataProtector OR npx jest sensitiveDataProtector

import {
  convertEnglishNumberWords,
  formatPhoneAndSSNDigits,
  stitchSingleDigitSequences,
  applyDisplayProtections,
  copyableDigits,
  repairNYCZipNumbers,
  hallucinationGuard,
  removeOverlapPreservingDigitSequences,
  detectSentinelContext,
  looksLikeAddressFragment,
  containsCriticalData,
  hasCriticalDataCue,
  containsNumberSequence,
  isNumberLike,
  cleanFillerWords,
} from './sensitiveDataProtector';

// ---------------------------------------------------------------------------
// convertEnglishNumberWords — lane-guard
// ---------------------------------------------------------------------------
describe('convertEnglishNumberWords — lane guard', () => {
  test('EN lane: converts English number words', () => {
    expect(convertEnglishNumberWords('Call me at seven one four', 'en')).toBe(
      'Call me at 7 1 4'
    );
  });

  test('EN lane: leaves Spanish "once" intact', () => {
    // "once" in English means "at one time" — must NOT become "11"
    expect(convertEnglishNumberWords('Once a week', 'en')).toBe('Once a week');
  });

  test('ES lane: converts Spanish "once" to 11', () => {
    expect(convertEnglishNumberWords('una vez once', 'es')).toBe('una vez 11');
  });

  test('ES lane: leaves English "one", "two" intact', () => {
    // In Spanish text these words don't appear, but if they do they shouldn't convert
    expect(convertEnglishNumberWords('one two three', 'es')).toBe('one two three');
  });

  test('EN lane: trailing punctuation is preserved', () => {
    // Regression: "seven, eight." should not become "7 8." (lost comma)
    expect(convertEnglishNumberWords('seven, eight.', 'en')).toBe('7, 8.');
  });

  test('ES lane: veinticinco converts to 25', () => {
    expect(convertEnglishNumberWords('veinticinco años', 'es')).toBe('25 años');
  });

  test('default (no lang arg) behaves like EN lane', () => {
    expect(convertEnglishNumberWords('nine one one')).toBe('9 1 1');
  });
});

// ---------------------------------------------------------------------------
// formatPhoneAndSSNDigits — SSN vs phone
// ---------------------------------------------------------------------------
describe('formatPhoneAndSSNDigits — SSN vs phone', () => {
  test('9-digit run → SSN format (NNN-NN-NNNN)', () => {
    expect(formatPhoneAndSSNDigits('123 45 6789')).toBe('123-45-6789');
  });

  test('10-digit run → US phone format (NNN-NNN-NNNN)', () => {
    expect(formatPhoneAndSSNDigits('1 2 3 4 5 6 7 8 9 0')).toBe('123-456-7890');
  });

  test('11-digit starting with 1 → +1 NNN-NNN-NNNN', () => {
    expect(formatPhoneAndSSNDigits('1 2 1 2 5 5 5 0 1 2 3')).toBe('+1 212-555-0123');
  });

  test('SSN typed with spaces → SSN format', () => {
    expect(formatPhoneAndSSNDigits('078 05 1120')).toBe('078-05-1120');
  });

  test('leaves short digit runs alone (< 8 digits)', () => {
    expect(formatPhoneAndSSNDigits('Room 1234')).toBe('Room 1234');
  });
});

// ---------------------------------------------------------------------------
// stitchSingleDigitSequences
// ---------------------------------------------------------------------------
describe('stitchSingleDigitSequences', () => {
  test('collapses spaced single digits', () => {
    expect(stitchSingleDigitSequences('call 5 5 5 1 2 3 4')).toBe('call 5551234');
  });

  test('collapses after number-word conversion path', () => {
    const converted = convertEnglishNumberWords('nine one one', 'en');
    expect(stitchSingleDigitSequences(converted)).toBe('911');
  });

  test('does not collapse multi-digit tokens', () => {
    expect(stitchSingleDigitSequences('Room 12 34')).toBe('Room 12 34');
  });

  test('leaves short non-sequence alone', () => {
    expect(stitchSingleDigitSequences('floor 3')).toBe('floor 3');
  });
});

describe('applyDisplayProtections', () => {
  test('stitches then formats phone dictation', () => {
    expect(applyDisplayProtections('two one two five five five zero one zero zero', 'en'))
      .toBe('212-555-0100');
  });

  test('preserves EN once', () => {
    expect(applyDisplayProtections('Once a week', 'en')).toBe('Once a week');
  });
});

describe('copyableDigits', () => {
  test('strips non-digits for clipboard', () => {
    expect(copyableDigits('212-555-0100')).toBe('2125550100');
  });
});

// ---------------------------------------------------------------------------
// repairNYCZipNumbers
// ---------------------------------------------------------------------------
describe('repairNYCZipNumbers', () => {
  test('repairs 3-digit NYC zips', () => {
    expect(repairNYCZipNumbers('New York 134')).toBe('New York 10034');
  });

  test('NY abbreviation variant', () => {
    expect(repairNYCZipNumbers('NY 168')).toBe('NY 10068');
  });

  test('does not touch non-NYC cities', () => {
    expect(repairNYCZipNumbers('Los Angeles 134')).toBe('Los Angeles 134');
  });
});

// ---------------------------------------------------------------------------
// detectSentinelContext
// ---------------------------------------------------------------------------
describe('detectSentinelContext', () => {
  test('detects "social" → SSN mode in EN', () => {
    expect(detectSentinelContext('my social is', 'en').mode).toBe('ssn');
  });

  test('detects "seguro social" → SSN mode in ES', () => {
    expect(detectSentinelContext('mi seguro social', 'es').mode).toBe('ssn');
  });

  test('detects email sentinel in EN', () => {
    expect(detectSentinelContext('my email address is', 'en').mode).toBe('email');
  });

  test('detects "correo" sentinel in ES', () => {
    expect(detectSentinelContext('mi correo es', 'es').mode).toBe('email');
  });

  test('detects spelling sentinel in EN', () => {
    expect(detectSentinelContext('let me spell my last name', 'en').mode).toBe('spelling');
  });

  test('detects mailing address sentinel in EN', () => {
    expect(detectSentinelContext('my mailing address is', 'en').mode).toBe('address');
  });

  test('detects "dirección" in ES', () => {
    expect(detectSentinelContext('mi dirección es', 'es').mode).toBe('address');
  });

  test('returns null mode for neutral text', () => {
    expect(detectSentinelContext('I feel fine today', 'en').mode).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(detectSentinelContext('', 'en').mode).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// critical medical/admin data protection
// ---------------------------------------------------------------------------
describe('critical medical/admin data protection', () => {
  test('detects appointment date cue', () => {
    expect(hasCriticalDataCue('scheduled for June first')).toBe(true);
    expect(containsCriticalData('scheduled for June first')).toBe(true);
  });

  test('detects numeric appointment date and time', () => {
    expect(
      containsCriticalData('appointment is on 06/14 at 9:30 AM')
    ).toBe(true);
  });

  test('detects medication dosage', () => {
    expect(containsCriticalData('take metformin 500 mg twice daily')).toBe(true);
  });

  test('detects medication price', () => {
    expect(containsCriticalData('the medication costs $45')).toBe(true);
  });

  test('detects consultation price', () => {
    expect(containsCriticalData('the consultation is 120 dollars')).toBe(true);
  });

  test('detects Spanish appointment date', () => {
    expect(containsCriticalData('el turno es el 14 de junio')).toBe(true);
  });

  test('detects Spanish medication dosage', () => {
    expect(
      containsCriticalData('tome metformina 500 mg dos veces al día')
    ).toBe(true);
  });

  test('detects Spanish consultation price', () => {
    expect(containsCriticalData('la consulta cuesta 12000 pesos')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// looksLikeAddressFragment
// ---------------------------------------------------------------------------
describe('looksLikeAddressFragment', () => {
  test('detects street type in text after', () => {
    // "20" before "West 34th Street" — textBefore is empty, textAfter has "Street"
    expect(looksLikeAddressFragment('', 'West 34th Street')).toBe(true);
  });

  test('detects directional in text before', () => {
    expect(looksLikeAddressFragment('lives on North', '4th Avenue')).toBe(true);
  });

  test('returns false for unrelated context', () => {
    expect(looksLikeAddressFragment('patient is', 'years old')).toBe(false);
  });

  test('detects avenue in text after', () => {
    expect(looksLikeAddressFragment('', '5th Avenue New York')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hallucinationGuard
// ---------------------------------------------------------------------------
describe('hallucinationGuard', () => {
  test('removes single filler words', () => {
    expect(hallucinationGuard('bueno')).toBe('');
    expect(hallucinationGuard('um')).toBe('');
  });

  test('preserves single numbers', () => {
    expect(hallucinationGuard('9')).toBe('9');
    expect(hallucinationGuard('one')).toBe('one');
  });

  test('deduplicates immediate stutter', () => {
    expect(hallucinationGuard('the the the patient')).toBe('the patient');
  });

  test('preserves repeated numbers (phone dictation)', () => {
    // "five five five" must NOT be deduplicated
    expect(hallucinationGuard('five five five')).toBe('five five five');
  });

  test('does not prune short sentences', () => {
    const short = 'The patient has chest pain';
    expect(hallucinationGuard(short)).toBe(short);
  });
});

// ---------------------------------------------------------------------------
// removeOverlapPreservingDigitSequences
// ---------------------------------------------------------------------------
describe('removeOverlapPreservingDigitSequences', () => {
  test('removes word-level overlap between chunks', () => {
    const base = 'the patient is thirty';
    const addition = 'thirty years old';
    // Overlap token is number-like ("thirty") => overlap must be preserved.
    expect(removeOverlapPreservingDigitSequences(base, addition)).toBe('thirty years old');
  });

  test('does NOT remove overlap when digits are involved', () => {
    // Phone number straddling a chunk boundary — must not lose digits
    const base = 'call me at 212';
    const addition = '212 555 0100';
    // "212" overlaps but contains digits → overlap is zeroed out
    expect(removeOverlapPreservingDigitSequences(base, addition)).toBe('212 555 0100');
  });

  test('preserves overlap when critical date data is present', () => {
    const base = 'the appointment is scheduled for';
    const addition = 'scheduled for June first';
    expect(removeOverlapPreservingDigitSequences(base, addition)).toBe(addition);
  });

  test('preserves overlap when critical medication dosage is present', () => {
    const base = 'take metformin';
    const addition = 'metformin 500 mg twice daily';
    expect(removeOverlapPreservingDigitSequences(base, addition)).toBe(addition);
  });

  test('preserves overlap when critical price data is present', () => {
    const base = 'the consultation costs';
    const addition = 'costs 120 dollars';
    expect(removeOverlapPreservingDigitSequences(base, addition)).toBe(addition);
  });

  test('handles empty addition', () => {
    expect(removeOverlapPreservingDigitSequences('hello', '')).toBe('');
  });

  test('handles empty base', () => {
    expect(removeOverlapPreservingDigitSequences('', 'hello world')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// containsNumberSequence
// ---------------------------------------------------------------------------
describe('containsNumberSequence', () => {
  test('true for consecutive numeric words', () => {
    expect(containsNumberSequence('five five five', 2)).toBe(true);
  });

  test('true for number-dense text (>30%)', () => {
    expect(containsNumberSequence('one hundred twenty', 2)).toBe(true);
  });

  test('false for a normal sentence', () => {
    expect(containsNumberSequence('the patient seems fine', 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cleanFillerWords
// ---------------------------------------------------------------------------
describe('cleanFillerWords', () => {
  test('strips leading filler', () => {
    expect(cleanFillerWords('um so my name is John')).toBe('my name is John');
  });

  test('strips phrase fillers', () => {
    expect(cleanFillerWords('I mean the patient you know has pain')).toBe(
      'the patient has pain'
    );
  });

  test('leaves number-only content alone', () => {
    expect(cleanFillerWords('5 5 5 0 1 2 3')).toBe('5 5 5 0 1 2 3');
  });
});
