import {
  extractSensitiveTokens,
  normalizeTokenForCompare,
  diffSensitiveTokens,
} from './translationSensitiveTokens';

describe('translationSensitiveTokens', () => {
  test('extracts phone and dosage', () => {
    const bag = extractSensitiveTokens(
      'Call 555-123-4567 and take 500 mg metformin. DOB 01/02/1970.',
    );
    expect(bag.phones.some((p) => normalizeTokenForCompare(p) === 'd:5551234567')).toBe(true);
    expect(bag.dosages.length).toBeGreaterThan(0);
    expect(bag.dobs).toContain('01/02/1970');
  });

  test('reformatted digits are not missing', () => {
    const missing = diffSensitiveTokens('5551234567', '555-123-4567');
    expect(missing).toEqual([]);
  });

  test('missing phone is reported', () => {
    const missing = diffSensitiveTokens(
      'Please call 5551234567',
      'Por favor llame',
    );
    expect(missing.length).toBeGreaterThan(0);
    expect(normalizeTokenForCompare(missing[0])).toBe('d:5551234567');
  });

  // v4.93.0 regression: ordinary phrases must NOT look like "addresses".
  // These false positives flooded transcripts with [⚠ Check: …] markers.
  test('ordinary words are not sensitive tokens', () => {
    const bag = extractSensitiveTokens(
      'allow up between 7 minutes 5 to 7 minutes to receive the email, but it can take up to 15 minutes. Select 1 of the providers.',
    );
    expect(bag.addresses).toEqual([]);
    expect(bag.phones).toEqual([]);
    expect(bag.ids).toEqual([]);
  });

  test('real street addresses still detected', () => {
    const bag = extractSensitiveTokens('Send it to 123 Main Street please.');
    expect(bag.addresses.length).toBeGreaterThan(0);
  });

  // v4.115.0: translation digit-loss safety covers times, money, MRNs, pills.
  test('times, money, chart IDs survive diff', () => {
    expect(diffSensitiveTokens('slots 1:00, 1:30', 'ranuras 1:00, 1:30')).toEqual([]);
    expect(diffSensitiveTokens('cita a las 14:30', 'appt at 14:30')).toEqual([]);
    expect(diffSensitiveTokens('copay $1,234.56', 'copago $1,234.56')).toEqual([]);
    const bag = extractSensitiveTokens('MRN chart 12345678, take 2 pills, call at 3pm');
    expect(bag.ids.length).toBeGreaterThan(0);
    expect(bag.dosages.some((d) => /2\s*pills/.test(d))).toBe(true);
    expect(bag.times.some((t) => /3\s*pm/i.test(t))).toBe(true);
  });

  test('dropped time is reported missing', () => {
    expect(diffSensitiveTokens('slots 1:00, 1:30', 'ranuras')).toEqual(['1:00', '1:30']);
  });

  // v4.116.0: pure-digit tokens compare exact at any length.
  test('short digit typo is missing, identical is fine', () => {
    expect(diffSensitiveTokens('zip 10027', 'zip 10072')).toEqual(['10027']);
    expect(diffSensitiveTokens('zip 10027', 'zip 10027')).toEqual([]);
    expect(normalizeTokenForCompare('5')).toBe('d:5');
  });
});
