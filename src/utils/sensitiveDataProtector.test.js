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
  expandClerkTimeShorthand,
  findScheduleUnits,
  combineCompoundNumbers,
  expandWordTimes,
  findSpokenEmailUnits,
  collapseAdjacentDigitRepeats,
  repairSplitZips,
  normalizeAddressDirectionals,
} from './sensitiveDataProtector';
import { armExpectedData, clearExpectedData } from './expectedDataContext';

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

  test('Phase G: EN affiliate/Medicaid ID cues hit ssn sentinel', () => {
    expect(detectSentinelContext('here come 2 numbers, there is the affiliate number', 'en').mode).toBe('ssn');
    expect(detectSentinelContext('there is the Medicaid ID number, which one do you need', 'en').mode).toBe('ssn');
    expect(detectSentinelContext('I can take the member number', 'en').mode).toBe('ssn');
  });

  test('Phase G: EN Medicaid ID digits stitch + group as one unit', () => {
    const raw = 'I can take the Medicaid ID number 1 0 1 3 1 5 9 5 1 6';
    expect(detectSentinelContext(raw, 'en').mode).toBe('ssn');
    expect(applyDisplayProtections(raw, 'en')).toMatch(/101-315-9516/);
  });

  test('Phase G: ES afiliado/Medicaid cues hit ssn sentinel', () => {
    expect(detectSentinelContext('aquí vienen 2 números, viene el número de afiliado', 'es').mode).toBe('ssn');
    expect(detectSentinelContext('viene el número de identificación del Medicaid, cuál necesita', 'es').mode).toBe('ssn');
    expect(detectSentinelContext('puedo tomar el número de miembro', 'es').mode).toBe('ssn');
  });

  test('Phase G: ES afiliado digits stitch + group as one unit', () => {
    const raw = 'viene el número de afiliado 1 0 1 3 1 5 9 5 1 6';
    expect(detectSentinelContext(raw, 'es').mode).toBe('ssn');
    expect(applyDisplayProtections(raw, 'es')).toMatch(/101-315-9516/);
  });

  test('Phase G: ssn sentinel wins over address/date so ID digits still group', () => {
    const raw = 'my Medicaid ID number is 1013159516, Madison Avenue appointment May 8';
    expect(detectSentinelContext(raw, 'en').mode).toBe('ssn');
    expect(applyDisplayProtections(raw, 'en')).toMatch(/101-315-9516/);
  });
});

describe('findAddressUnits / findEmailUnits (Phase F)', () => {
  test('groups street number, unit, and zip after state', () => {
    const text = 'number 1935, Madison Avenue, Unit, 111, Chula Vista, California, 91913';
    const addr = findAddressUnits(text);
    // v4.118.0: street span is one unit ("1935, Madison Avenue").
    expect(addr.some((u) => u.text === '1935, Madison Avenue' && u.copyValue === '1935, Madison Avenue')).toBe(true);
    expect(addr.some((u) => u.text === 'Unit, 111')).toBe(true);
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
// clerk time shorthand (v4.114.0) — "1 1 30" = 1:00 AND 1:30, never 1130
// ---------------------------------------------------------------------------
describe('clerk time shorthand (v4.114.0)', () => {
  test('expands single shorthand to two slots', () => {
    expect(expandClerkTimeShorthand('we have 1 1 30')).toBe('we have 1:00, 1:30');
  });

  test('expands clerk list without mangling', () => {
    expect(expandClerkTimeShorthand('we have 1 1 30, 2 2 30')).toBe(
      'we have 1:00, 1:30, 2:00, 2:30'
    );
  });

  test('two-digit hours expand', () => {
    expect(expandClerkTimeShorthand('slots 10 10 30')).toBe('slots 10:00, 10:30');
  });

  test(':00 shorthand collapses to one slot (no dupe)', () => {
    expect(expandClerkTimeShorthand('have 3 3 00')).toBe('have 3:00');
  });

  test('phone-style repeats are untouched', () => {
    expect(expandClerkTimeShorthand('call 5 5 5 1 2 3 4')).toBe('call 5 5 5 1 2 3 4');
    expect(expandClerkTimeShorthand('my social is 123456789')).toBe('my social is 123456789');
  });

  test('hours outside 1-12 are untouched', () => {
    expect(expandClerkTimeShorthand('code 15 15 30')).toBe('code 15 15 30');
  });

  test('full pipeline: clerk list survives, phones still format', () => {
    const out = applyDisplayProtections('we have 1 1 30, 2 2 30', 'en');
    expect(out).toBe('we have 1:00, 1:30, 2:00, 2:30');
    expect(out).not.toMatch(/113-022-30|130-23/);
    expect(applyDisplayProtections('call 5551234567', 'en')).toMatch(/555-123-4567/);
  });

  test('number-word path: "one one thirty" expands', () => {
    expect(applyDisplayProtections('we have one one thirty', 'en')).toBe('we have 1:00, 1:30');
  });

  test('expanded times are schedule highlight units', () => {
    const segs = splitHighlightSegments('we have 1:00, 1:30');
    expect(segs.filter((s) => s.type === 'schedule')).toHaveLength(2);
    expect(segs.filter((s) => s.type === 'number')).toHaveLength(0);
  });

  test('findScheduleUnits catches bare + am/pm times', () => {
    expect(findScheduleUnits('at 2:30 pm please')[0]?.text).toBe('2:30 pm');
  });

  test('clerk shorthand + bare times count as critical data', () => {
    expect(containsCriticalData('we have 1 1 30')).toBe(true);
    expect(containsCriticalData('slots at 1:00, 1:30')).toBe(true);
  });

  test('shorthand triggers date sentinel brake', () => {
    expect(detectSentinelContext('we have 1 1 30', 'en').mode).toBe('date');
    expect(detectSentinelContext('slots at 1:00, 1:30', 'en').mode).toBe('date');
  });
});

// ---------------------------------------------------------------------------
// v4.115.0: DOB/ZIP/MRN/compounds/money/email/street/word-times
// ---------------------------------------------------------------------------
describe('sensitive data round 2 (v4.115.0)', () => {
  test('ZIP+4 is not an SSN', () => {
    expect(formatPhoneAndSSNDigits('zip 10027-1234')).toBe('zip 10027-1234');
    expect(applyDisplayProtections('live at 10027-1234', 'en')).toContain('10027-1234');
  });

  test('8-digit MRN near chart cue stays undashed', () => {
    const out = applyDisplayProtections('MRN 12345678 please', 'en');
    expect(out).toContain('12345678');
    expect(out).not.toMatch(/123-456-78/);
  });

  test('spaced DOB masks as one date unit with BOTH ISO readings', () => {
    const units = findDateUnits('my DOB is 05 12 1980');
    expect(units).toHaveLength(1);
    expect(units[0].text).toBe('05 12 1980');
    expect(units[0].copyValue).toBe('1980-05-12 / 1980-12-05');
  });

  test('spaced DOB survives the full pipeline', () => {
    const out = applyDisplayProtections('my DOB is 05 12 1980', 'en');
    expect(out).toContain('05 12 1980');
    expect(out).not.toMatch(/051-219-80|05121980/);
    expect(containsCriticalData('my DOB is 05 12 1980')).toBe(true);
  });

  test('dotted ES date is one unit (day>12 forces DMY)', () => {
    const units = findDateUnits('nacido el 25.12.1980');
    expect(units).toHaveLength(1);
    expect(units[0].text).toBe('25.12.1980');
    expect(units[0].copyValue).toBe('1980-12-25');
  });

  test('version numbers are not dates', () => {
    expect(findDateUnits('update to v1.2 today')).toHaveLength(0);
  });

  test('EN tens+unit combine', () => {
    expect(applyDisplayProtections('eighty two', 'en')).toBe('82');
    expect(applyDisplayProtections('room twenty one', 'en')).toBe('room 21');
  });

  test('ES tens+y+unit combine', () => {
    expect(applyDisplayProtections('ochenta y dos', 'es')).toBe('82');
  });

  test('decimal words become decimals + dosage units', () => {
    expect(applyDisplayProtections('two point five mg', 'en')).toBe('2.5 mg');
    expect(applyDisplayProtections('dos punto cinco ml', 'es')).toBe('2.5 ml');
    expect(findDosageUnits('take 2.5 ml')[0]?.text).toBe('2.5 ml');
  });

  test('pills/gotas are dosage units', () => {
    expect(findDosageUnits('take 2 pills')[0]?.text).toBe('2 pills');
    expect(findDosageUnits('tome 5 gotas')[0]?.text).toBe('5 gotas');
    expect(applyDisplayProtections('take two pills daily', 'en')).toContain('2 pills');
  });

  test('money thousands are one unit', () => {
    expect(findMoneyUnits('copay $1,234.56 today')[0]?.text).toBe('$1,234.56');
    const segs = splitHighlightSegments('total $1,234.56');
    expect(segs.filter((s) => s.type === 'money')).toHaveLength(1);
  });

  test('spoken email reconstructs clipboard, display verbatim', () => {
    const units = findSpokenEmailUnits('contact juan at gmail dot com please');
    expect(units).toHaveLength(1);
    expect(units[0].copyValue).toBe('juan@gmail.com');
    expect(findSpokenEmailUnits('meet at noon tomorrow')).toHaveLength(0);
  });

  test('Calle number-first ES address is one unit', () => {
    const units = findAddressUnits('vive en Calle 45 # 12-34');
    expect(units.some((u) => u.text.includes('45'))).toBe(true);
  });

  test('word times normalize to clock form', () => {
    expect(applyDisplayProtections('come at half past two', 'en')).toContain('2:30');
    expect(applyDisplayProtections('at three thirty', 'en')).toContain('3:30');
    expect(applyDisplayProtections('a las tres y media', 'es')).toContain('3:30');
  });

  test('24h times survive + highlight as schedule', () => {
    expect(applyDisplayProtections('cita a las 14:30', 'es')).toContain('14:30');
    expect(findScheduleUnits('at 14:30 sharp')[0]?.text).toBe('14:30');
    expect(findScheduleUnits('call at 3pm')[0]?.text).toBe('3pm');
  });

  test('decimals survive stitch (v4.115.0 guard)', () => {
    expect(applyDisplayProtections('take 2.5 ml twice daily', 'en')).toContain('2.5 ml');
    expect(stitchSingleDigitSequences('dose 2.5 mg')).toBe('dose 2.5 mg');
  });

  test('IPs are not phones', () => {
    expect(formatPhoneAndSSNDigits('server 192.168.1.1 down')).toBe('server 192.168.1.1 down');
  });

  test('slash dictation stitches', () => {
    expect(stitchSingleDigitSequences('5/5/5/1/2/3/4')).toBe('5551234');
  });

  test('ambiguous slash date copies both readings, display verbatim', () => {
    const units = findDateUnits('date 05/12/1980');
    expect(units[0]?.text).toBe('05/12/1980');
    expect(units[0]?.copyValue).toBe('1980-05-12 / 1980-12-05');
    expect(applyDisplayProtections('date 05/12/1980', 'en')).toContain('05/12/1980');
  });

  test('non-US digit lengths stay verbatim without phone cue', () => {
    expect(applyDisplayProtections('code 12345678 ok', 'en')).toContain('12345678');
    expect(applyDisplayProtections('code 12345678 ok', 'en')).not.toMatch(/123-456-78/);
  });

  test('explicit phone cue still groups odd lengths', () => {
    expect(applyDisplayProtections('my phone number is 1 2 3 4 5 6 7 8', 'en')).toMatch(/123-456-78/);
  });

  test('overlap keeps both copies when digits differ in spacing', () => {
    expect(removeOverlapPreservingDigitSequences('call 12 34', '12 34 now')).toBe('12 34 now');
    expect(removeOverlapPreservingDigitSequences('call 1234', '12 34 now')).toBe('12 34 now');
    expect(removeOverlapPreservingDigitSequences('the patient is thirty', 'thirty years old')).toBe('thirty years old');
  });
});

// ---------------------------------------------------------------------------
// v4.117.0: armed expectation — the question formats later bubbles
// ---------------------------------------------------------------------------
describe('armed expectation (v4.117.0)', () => {
  beforeEach(() => {
    clearExpectedData();
  });

  test('armed phone groups 8 digits (verbatim rule overridden)', () => {
    armExpectedData('can I have your phone number', {});
    expect(applyDisplayProtections('1 2 3 4 5 6 7 8', 'en')).toMatch(/123-456-78/);
  });

  test('no arm: same 8 digits stay verbatim', () => {
    expect(applyDisplayProtections('code 12345678 ok', 'en')).toContain('12345678');
  });

  test('armed ssn beats ZIP+4 shape', () => {
    armExpectedData('what is your social', {});
    expect(applyDisplayProtections('10027-1234', 'en')).toBe('100-27-1234');
  });

  test('armed ssn formats spaced 9 digits', () => {
    armExpectedData('can I have your ssn', {});
    expect(applyDisplayProtections('1 2 3 4 5 6 7 8 9', 'en')).toBe('123-45-6789');
  });

  test('armed dob keeps spaced date verbatim', () => {
    armExpectedData('what is your date of birth', {});
    expect(applyDisplayProtections('05 12 1980', 'en')).toContain('05 12 1980');
  });

  test('explicit expectedType param works without the store', () => {
    expect(
      applyDisplayProtections('1 2 3 4 5 6 7 8', 'en', { expectedType: 'phone' }),
    ).toMatch(/123-456-78/);
  });

  test('straddle dupes collapse to one copy', () => {
    expect(collapseAdjacentDigitRepeats('call 555 123 123 4567')).toBe('call 555 123 4567');
    expect(
      applyDisplayProtections('call 555 123 123 4567', 'en'),
    ).toBe('call 555-123-4567');
  });

  test('identical single-digit runs never collapse', () => {
    expect(collapseAdjacentDigitRepeats('5 5 5 5')).toBe('5 5 5 5');
    expect(collapseAdjacentDigitRepeats('call 555 123 4567')).toBe('call 555 123 4567');
  });

  test('request phrasings hit sentinels', () => {
    expect(detectSentinelContext('can I have your phone number', 'en').mode).toBe('phone');
    expect(detectSentinelContext('can I have your social', 'en').mode).toBe('ssn');
    expect(detectSentinelContext('how old are you', 'en').mode).toBe('date');
    expect(detectSentinelContext('me puede dar su número de teléfono', 'es').mode).toBe('phone');
  });
});

// ---------------------------------------------------------------------------
// v4.118.0: addresses — split ZIPs, directional slot, whole-span chips
// ---------------------------------------------------------------------------
describe('addresses round 2 (v4.118.0)', () => {
  test('split ZIP joins near a state cue', () => {
    expect(repairSplitZips('Pumble, California, 93, 550.')).toBe('Pumble, California, 93550.');
    expect(repairSplitZips('zip 93, 550 please')).toBe('zip 93550 please');
  });

  test('counts without a cue never join', () => {
    expect(repairSplitZips('take 2, 500 pills')).toBe('take 2, 500 pills');
  });

  test('directional slot normalizes to compass letter', () => {
    expect(normalizeAddressDirectionals('Es 3247 e Avenida')).toBe('Es 3247 E Avenida');
    expect(normalizeAddressDirectionals("It's 3247 and Avenue")).toBe("It's 3247 E Avenue");
    expect(normalizeAddressDirectionals('vive en 12 oeste Calle')).toBe('vive en 12 W Calle');
  });

  test('ordinary "and" phrases untouched', () => {
    expect(normalizeAddressDirectionals('fish and chips')).toBe('fish and chips');
    expect(normalizeAddressDirectionals('bread and butter 12')).toBe('bread and butter 12');
  });

  test('full ES example survives the pipeline', () => {
    const out = applyDisplayProtections('Es 3247 e Avenida, s 1, Pumble, California, 93, 550.', 'es');
    expect(out).toContain('3247 E Avenida');
    expect(out).toContain('93550');
    expect(out).not.toMatch(/93, 550/);
  });

  test('street span is one address chip', () => {
    const units = findAddressUnits('123 Main Street');
    expect(units.some((u) => u.text === '123 Main Street')).toBe(true);
    const es = findAddressUnits('3247 E Avenida');
    expect(es.some((u) => u.text.includes('3247') && u.text.includes('Avenida'))).toBe(true);
  });

  test('suite shorthand chips only with address context', () => {
    expect(findSpokenEmailUnits('s 1').length).toBe(0);
    const units = findAddressUnits('3247 E Ave, s 1, California');
    expect(units.some((u) => u.text === 's 1')).toBe(true);
    expect(findAddressUnits('take vitamin s 1 daily')).toHaveLength(0);
  });

  test('apt letters survive in copy', () => {
    expect(findAddressUnits('apt 4B')[0]?.copyValue).toBe('4B');
  });

  test('address question still arms address mode', () => {
    expect(detectSentinelContext('Cuál es la nueva dirección', 'es').mode).toBe('address');
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
