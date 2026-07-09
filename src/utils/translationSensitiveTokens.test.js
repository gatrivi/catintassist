import {
  extractSensitiveTokens,
  normalizeTokenForCompare,
  diffSensitiveTokens,
  salvageSensitiveTokens,
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

  test('salvage uses Check marker', () => {
    const out = salvageSensitiveTokens('Hola', ['555-123-4567']);
    expect(out).toBe('Hola [⚠ Check: 555-123-4567]');
  });
});
