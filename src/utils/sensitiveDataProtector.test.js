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
  findDateUnits,
  splitHighlightSegments,
  looksLikeDateFragment,
  findDosageUnits,
  findMoneyUnits,
  findAddressUnits,
  findEmailUnits,
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

  test('does not phone-format address-like digit runs', () => {
    expect(formatPhoneAndSSNDigits('ship to 123 456 7890 West 34th Street')).toBe(
      'ship to 123 456 7890 West 34th Street'
    );
  });

  test('still formats phone-like digit runs without address context', () => {
    expect(formatPhoneAndSSNDigits('call 123 456 7890')).toBe('call 123-456-7890');
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

  test('does not phone-format a year inside a month date', () => {
    const out = applyDisplayProtections('born May 8 1990', 'en');
    expect(out).toContain('May 8 1990');
    expect(out).not.toMatch(/1-990/);
  });
});

describe('findDateUnits / splitHighlightSegments (Phase B)', () => {
  test('May 8 1990 is one date unit with ISO copy', () => {
    const units = findDateUnits('born May 8 1990');
    expect(units).toHaveLength(1);
    expect(units[0].text).toBe('May 8 1990');
    expect(units[0].copyValue).toBe('1990-05-08');
  });

  test('8 May 1990 is one date unit', () => {
    const units = findDateUnits('DOB 8 May 1990');
    expect(units[0]?.text).toBe('8 May 1990');
    expect(units[0]?.copyValue).toBe('1990-05-08');
  });

  test('numeric appointment date is one unit', () => {
    const units = findDateUnits('appointment 3/15/26');
    expect(units[0]?.text).toBe('3/15/26');
    expect(units[0]?.copyValue).toBe('2026-03-15');
  });

  test('highlight split: date is one segment, not lone day digit', () => {
    const segs = splitHighlightSegments('Did you say May 8 1990?');
    const dateSeg = segs.find((s) => s.type === 'date');
    expect(dateSeg?.value).toBe('May 8 1990');
    expect(segs.filter((s) => s.type === 'number' && s.value === '8')).toHaveLength(0);
  });

  test('8 mg is a dosage unit, not a lone day digit', () => {
    expect(findDateUnits('take 8 mg')).toHaveLength(0);
    expect(findDosageUnits('take 8 mg')[0]?.text).toBe('8 mg');
    const segs = splitHighlightSegments('take 8 mg');
    expect(segs.some((s) => s.type === 'dosage' && s.value === '8 mg')).toBe(true);
    expect(segs.filter((s) => s.type === 'number' && s.value === '8')).toHaveLength(0);
  });

  test('phone still formats', () => {
    expect(applyDisplayProtections('call 5551234567', 'en')).toMatch(/555-123-4567/);
  });

  test('looksLikeDateFragment near month', () => {
    expect(looksLikeDateFragment('born May ', ' 1990')).toBe(true);
    expect(looksLikeDateFragment('call me at ', ' please')).toBe(false);
  });
});

describe('dosage / money units (Phase E)', () => {
  test('500 mg is one dosage unit', () => {
    const units = findDosageUnits('take 500 mg twice daily');
    expect(units[0]?.text).toBe('500 mg');
    expect(units[0]?.copyValue).toBe('500 mg');
  });

  test('$25.00 is one money unit', () => {
    const units = findMoneyUnits('copay is $25.00 today');
    expect(units[0]?.text).toMatch(/\$\s*25\.00/);
  });

  test('highlight split keeps dosage together and phone separate', () => {
    const segs = splitHighlightSegments('take 2.5 ml then call 555-123-4567');
    expect(segs.some((s) => s.type === 'dosage' && /2\.5\s*ml/.test(s.value))).toBe(true);
    expect(segs.some((s) => s.type === 'number' && /555/.test(s.value))).toBe(true);
  });
});

describe('sentinel display gate (Phase C)', () => {
  test('address sentinel stitches single-digit dictation but does not phone-format', () => {
    const raw = 'my mailing address is 1 2 3 4 5 6 7 8 9 0 West 34th Street';
    expect(detectSentinelContext(raw, 'en').mode).toBe('address');
    const out = applyDisplayProtections(raw, 'en');
    expect(out).toContain('1234567890');
    expect(out).not.toMatch(/123-456-7890/);
  });

  test('HIPAA verification cues address sentinel and groups dictation digits', () => {
    const raw = 'For verification through HIPAA terms, I need the number 1 9 3 5, Madison Avenue, Unit, 1 1 1, Chula Vista, California, 9 1 9 1 3';
    expect(detectSentinelContext(raw, 'en').mode).toBe('address');
    const out = applyDisplayProtections(raw, 'en');
    expect(out).toContain('1935');
    expect(out).toContain('111');
    expect(out).toContain('91913');
    expect(out).not.toMatch(/123-456-7890|919-13/);
  });

  test('email sentinel does not stitch digit runs', () => {
    const raw = 'my email is john 1 2 3 at gmail dot com';
    expect(detectSentinelContext(raw, 'en').mode).toBe('email');
    expect(applyDisplayProtections(raw, 'en')).toContain('1 2 3');
  });

  test('spelling sentinel does not stitch letter-adjacent digits', () => {
    const raw = 'let me spell my last name S as in Sam, M as in Mary, I as in India';
    expect(detectSentinelContext(raw, 'en').mode).toBe('spelling');
    expect(applyDisplayProtections(raw, 'en')).toBe(raw);
  });

  test('date sentinel still leaves month date intact', () => {
    const raw = 'appointment scheduled May 8 1990';
    expect(detectSentinelContext(raw, 'en').mode).toBe('date');
    expect(applyDisplayProtections(raw, 'en')).toContain('May 8 1990');
  });

  test('phone sentinel still formats', () => {
    const raw = 'my phone number is 5551234567';
    expect(detectSentinelContext(raw, 'en').mode).toBe('phone');
    expect(applyDisplayProtections(raw, 'en')).toMatch(/555-123-4567/);
  });

  test('ssn sentinel still formats', () => {
    const raw = 'my social is 123456789';
    expect(detectSentinelContext(raw, 'en').mode).toBe('ssn');
    expect(applyDisplayProtections(raw, 'en')).toBe('my social is 123-45-6789');
  });

  test('dosage sentinel skips phone format but may stitch', () => {
    const raw = 'take medication 5 0 0 mg twice daily';
    expect(['dosage', 'medication']).toContain(detectSentinelContext(raw, 'en').mode);
    const out = applyDisplayProtections(raw, 'en');
    expect(out).not.toMatch(/\d{3}-\d{3}-\d{4}/);
    expect(out).toMatch(/500\s*mg|5 0 0\s*mg/);
  });
});

describe('findAddressUnits / findEmailUnits (Phase F)', () => {
  test('groups street number, unit, and zip after state', () => {
    const text = 'number 1935, Madison Avenue, Unit, 111, Chula Vista, California, 91913';
    const addr = findAddressUnits(text);
    expect(addr.some((u) => u.text === '1935' && u.copyValue === '1935')).toBe(true);
    expect(addr.some((u) => u.text === '111')).toBe(true);
    expect(addr.some((u) => u.text === '91913')).toBe(true);
  });

  test('email is one highlight unit', () => {
    const units = findEmailUnits('contact felita1984@hotmail.com please');
    expect(units).toHaveLength(1);
    expect(units[0].copyValue).toBe('felita1984@hotmail.com');
  });

  test('splitHighlightSegments keeps full date as one span', () => {
    const segs = splitHighlightSegments('born May 8, 1948');
    expect(segs.some((s) => s.type === 'date' && /May 8.*1948/.test(s.value))).toBe(true);
    expect(segs.filter((s) => s.type === 'number')).toHaveLength(0);
  });

  test('splitHighlightSegments keeps stitched address zip as one number span', () => {
    const disp = applyDisplayProtections(
      'For verification through HIPAA, number 9 1 9 1 3, California',
      'en',
    );
    const segs = splitHighlightSegments(disp);
    expect(segs.some((s) => (s.type === 'number' || s.type === 'address') && s.value.includes('91913'))).toBe(true);
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
