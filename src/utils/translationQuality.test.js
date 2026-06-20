import {
  translationSimilarity,
  isTranslationPassthrough,
  isTranslationStuckForRetranslate,
  splitTranslatableSegments,
  isIncrementalTranscriptGrowth,
} from './translationQuality';

describe('translationSimilarity', () => {
  test('identical strings score 1', () => {
    expect(translationSimilarity('hello world', 'hello world')).toBe(1);
  });

  test('good Spanish translation scores low', () => {
    const en = 'Midvale will make the payment deductions in the amount indicated on your billing statement.';
    const es = 'Midvale realizará las deducciones de pago en el monto indicado en su estado de cuenta.';
    expect(translationSimilarity(en, es)).toBeLessThan(0.3);
  });
});

describe('isTranslationPassthrough', () => {
  test('rejects identical English echo', () => {
    const src =
      'Additionally, if you are assessed in audit non compliant charge in accordance with the terms of your policy contract, it will be automatically deducted.';
    expect(isTranslationPassthrough(src, src, 'en', 'es')).toBe(true);
  });

  test('accepts real Spanish', () => {
    const en = 'Refer to your bill for this schedule of deductions and any applicable fees.';
    const es = 'Consulte su factura para conocer este programa de deducciones y los cargos aplicables.';
    expect(isTranslationPassthrough(en, es, 'en', 'es')).toBe(false);
  });

  test('rejects mostly-English mixed output', () => {
    const en =
      'This authorization shall apply to any renewal reinstated, or amended policy with Midvale unless revoked by you.';
    const bad = `${en} Está bien.`;
    expect(isTranslationPassthrough(en, bad, 'en', 'es')).toBe(true);
  });
});

describe('splitTranslatableSegments', () => {
  test('single sentence stays one segment', () => {
    const text = 'Account indicated your policy for insurance premiums for your policy.';
    expect(splitTranslatableSegments(text)).toEqual([text]);
  });

  test('splits multiple sentences and trailing tail', () => {
    const text = 'First sentence. Second sentence. tail fragment';
    expect(splitTranslatableSegments(text)).toEqual([
      'First sentence.',
      'Second sentence.',
      'tail fragment',
    ]);
  });
});

describe('isTranslationStuckForRetranslate', () => {
  test('weak same-word accept is not stuck (v4.55.0)', () => {
    expect(
      isTranslationStuckForRetranslate('K.', 'K.', 'en', 'es', { quality: 'weak' }),
    ).toBe(false);
  });

  test('passthrough without weak flag is stuck', () => {
    expect(
      isTranslationStuckForRetranslate('Hello world', 'Hello world', 'en', 'es', { quality: 'ok' }),
    ).toBe(true);
  });
});

describe('isIncrementalTranscriptGrowth', () => {
  test('detects growing interim', () => {
    expect(isIncrementalTranscriptGrowth('hello', 'hello world')).toBe(true);
  });

  test('detects bubble split rewrite', () => {
    const long =
      'Account indicated your policy for insurance premiums for your policy. Midvale will make the payment.';
    const short = 'Account indicated your policy for insurance premiums for your policy.';
    expect(isIncrementalTranscriptGrowth(long, short)).toBe(false);
  });

  test('detects comma-chunk split (long breath → first chunk only)', () => {
    const long =
      'We need your member ID, date of birth, and the name on the account for verification today.';
    const firstChunk = 'We need your member ID, date of birth,';
    expect(isIncrementalTranscriptGrowth(long, firstChunk)).toBe(false);
  });
});
