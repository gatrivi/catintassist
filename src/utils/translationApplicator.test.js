import {
  buildTranslationKey,
  hashTranslationSource,
  buildSegmentRequestId,
  assignSegmentIds,
  isGarbageTranslation,
  applyTranslationResult,
  composeCaptionTranslation,
  segmentLongMonologue,
  shouldPersistTranslationEntry,
} from './translationApplicator';

describe('translationApplicator keys', () => {
  test('delimiter-safe :: key', () => {
    const key = buildTranslationKey({
      captionId: 'cap-1',
      segmentId: 'seg-0',
      sourceHash: 'abc',
      targetLang: 'es',
    });
    expect(key).toBe('cap-1::seg-0::abc::es');
  });

  test('requestId matches key', () => {
    const args = {
      captionId: 'c',
      segmentId: 'seg-1',
      sourceHash: 'h',
      targetLang: 'en',
    };
    expect(buildSegmentRequestId(args)).toBe(buildTranslationKey(args));
  });

  test('hash is stable for normalized whitespace', () => {
    expect(hashTranslationSource('Hello  world')).toBe(hashTranslationSource('Hello world'));
  });
});

describe('isGarbageTranslation', () => {
  test('rejects bueno on real sentence', () => {
    expect(
      isGarbageTranslation(
        'Your appointment is confirmed for March fifteenth at ten am.',
        'bueno',
      ),
    ).toBe(true);
  });

  test('allows short filler when source is short', () => {
    expect(isGarbageTranslation('ok', 'vale')).toBe(false);
  });
});

describe('segmentLongMonologue', () => {
  test('chunks long text around 40 words', () => {
    const words = Array.from({ length: 90 }, (_, i) => `w${i}`);
    const segs = segmentLongMonologue(words.join(' '), { maxWords: 40 });
    expect(segs.length).toBeGreaterThanOrEqual(2);
    segs.forEach((s) => {
      expect(s.split(/\s+/).length).toBeLessThanOrEqual(45);
    });
  });
});

describe('applyTranslationResult', () => {
  const baseEvent = {
    captionId: 'cap-a',
    segmentId: 'seg-0',
    sourceText: 'Please call me at 5551234567 tomorrow morning.',
    targetLang: 'es',
  };

  test('accepts good translation', () => {
    const sourceHash = hashTranslationSource(baseEvent.sourceText);
    const requestId = buildSegmentRequestId({
      ...baseEvent,
      sourceHash,
    });
    const { entry } = applyTranslationResult(
      {},
      {
        ...baseEvent,
        sourceHash,
        engineResult: {
          text: 'Por favor llámeme al 555-123-4567 mañana por la mañana.',
          engineId: 'mock',
          quality: 'ok',
          requestId,
        },
      },
    );
    expect(entry.status).toBe('ok');
    expect(entry.preserved).toBe(false);
    expect(entry.text).toMatch(/555/);
  });

  test('stale event.sourceHash preserves previous-good', () => {
    const sourceHash = hashTranslationSource(baseEvent.sourceText);
    const key = buildTranslationKey({
      captionId: baseEvent.captionId,
      segmentId: baseEvent.segmentId,
      sourceHash,
      targetLang: 'es',
    });
    const prev = {
      key,
      text: 'Traducción buena previa.',
      status: 'ok',
      quality: 'ok',
    };
    const { entry, state } = applyTranslationResult(
      { [key]: prev },
      {
        ...baseEvent,
        sourceHash: 'wronghash',
        previousEntry: prev,
        engineResult: {
          text: 'basura tardía',
          engineId: 'late',
          quality: 'ok',
          requestId: 'wrong-request',
        },
      },
    );
    expect(entry.preserved).toBe(true);
    expect(entry.warning).toBe('stale');
    expect(entry.status).toBe('ok');
    expect(entry.text).toBe('Traducción buena previa.');
    expect(state[key].text).toBe('Traducción buena previa.');
  });

  test('blank result preserves previous-good', () => {
    const sourceHash = hashTranslationSource(baseEvent.sourceText);
    const requestId = buildSegmentRequestId({ ...baseEvent, sourceHash });
    const prev = { text: 'Buena.', status: 'ok', quality: 'ok' };
    const { entry } = applyTranslationResult(
      {},
      {
        ...baseEvent,
        sourceHash,
        previousEntry: prev,
        engineResult: { text: '', engineId: 'x', quality: 'failed', requestId },
      },
    );
    expect(entry.preserved).toBe(true);
    expect(entry.warning).toBe('blank');
    expect(entry.text).toBe('Buena.');
    expect(entry.status).toBe('ok');
  });

  test('garbage preserves previous-good', () => {
    const sourceHash = hashTranslationSource(baseEvent.sourceText);
    const requestId = buildSegmentRequestId({ ...baseEvent, sourceHash });
    const prev = { text: 'Buena.', status: 'ok', quality: 'ok' };
    const { entry } = applyTranslationResult(
      {},
      {
        ...baseEvent,
        sourceHash,
        previousEntry: prev,
        engineResult: { text: 'bueno', engineId: 'x', quality: 'ok', requestId },
      },
    );
    expect(entry.warning).toBe('garbage_rejected');
    expect(entry.preserved).toBe(true);
    expect(entry.text).toBe('Buena.');
  });

  test('sibling keys untouched', () => {
    const sourceHash = hashTranslationSource(baseEvent.sourceText);
    const requestId = buildSegmentRequestId({ ...baseEvent, sourceHash });
    const sibKey = buildTranslationKey({
      captionId: 'cap-a',
      segmentId: 'seg-1',
      sourceHash: 'other',
      targetLang: 'es',
    });
    const state = {
      [sibKey]: { key: sibKey, text: 'Hermano ok', status: 'ok', segmentId: 'seg-1' },
    };
    const { state: next } = applyTranslationResult(state, {
      ...baseEvent,
      sourceHash,
      engineResult: { text: '', engineId: 'x', quality: 'failed', requestId },
    });
    expect(next[sibKey].text).toBe('Hermano ok');
  });

  test('sensitive token loss salvages with Check marker', () => {
    const sourceText = 'My callback number is 5551234567.';
    const sourceHash = hashTranslationSource(sourceText);
    const requestId = buildSegmentRequestId({
      captionId: 'c',
      segmentId: 'seg-0',
      sourceHash,
      targetLang: 'es',
    });
    const { entry } = applyTranslationResult(
      {},
      {
        captionId: 'c',
        segmentId: 'seg-0',
        sourceText,
        sourceHash,
        targetLang: 'es',
        engineResult: {
          text: 'Mi número de devolución de llamada es.',
          engineId: 'mock',
          quality: 'ok',
          requestId,
        },
      },
    );
    expect(entry.warning).toBe('sensitive_token_loss');
    expect(entry.text).toContain('[⚠ Check:');
    expect(entry.text).toMatch(/555/);
  });

  test('reformatted phone is not missing', () => {
    const sourceText = 'Call 5551234567 please.';
    const sourceHash = hashTranslationSource(sourceText);
    const requestId = buildSegmentRequestId({
      captionId: 'c',
      segmentId: 'seg-0',
      sourceHash,
      targetLang: 'es',
    });
    const { entry } = applyTranslationResult(
      {},
      {
        captionId: 'c',
        segmentId: 'seg-0',
        sourceText,
        sourceHash,
        targetLang: 'es',
        engineResult: {
          text: 'Llame al 555-123-4567 por favor.',
          engineId: 'mock',
          quality: 'ok',
          requestId,
        },
      },
    );
    expect(entry.warning).toBeUndefined();
    expect(entry.status).toBe('ok');
    expect(entry.text).not.toContain('[⚠ Check:');
  });
});

describe('composeCaptionTranslation', () => {
  test('joins by segment order', () => {
    const map = {
      a: { segmentId: 'seg-1', text: 'two' },
      b: { segmentId: 'seg-0', text: 'one' },
    };
    expect(composeCaptionTranslation(map)).toBe('one two');
  });
});

describe('assignSegmentIds + shouldPersist', () => {
  test('assignSegmentIds', () => {
    expect(assignSegmentIds(['a', 'b'])).toEqual([
      { segmentId: 'seg-0', text: 'a' },
      { segmentId: 'seg-1', text: 'b' },
    ]);
  });

  test('shouldPersistTranslationEntry', () => {
    expect(shouldPersistTranslationEntry({ status: 'ok', text: 'x' })).toBe(true);
    expect(shouldPersistTranslationEntry({ status: 'failed', text: '' })).toBe(false);
    expect(
      shouldPersistTranslationEntry({
        status: 'warning',
        warning: 'sensitive_token_loss',
        text: 'x [⚠ Check: 1]',
      }),
    ).toBe(true);
  });
});
