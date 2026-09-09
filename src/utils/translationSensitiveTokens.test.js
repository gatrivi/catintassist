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
});
