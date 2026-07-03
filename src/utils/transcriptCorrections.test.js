import {
  CORRECTIONS_STORAGE_KEY,
  CORRECTION_KIND,
  loadCorrections,
  saveCorrection,
  findCorrection,
  findGlossaryTranslation,
  applySttCorrections,
  exportCorrections,
  importCorrections,
  clearCorrections,
} from './transcriptCorrections';

describe('transcriptCorrections v4.76', () => {
  beforeEach(() => {
    clearCorrections();
  });

  test('save and find exact normalized STT match', () => {
    saveCorrection({
      sourceHeard: '  Mid Vail  ',
      corrected: 'Midvale',
      lang: 'en',
    });
    const hit = findCorrection('mid vail', 'en');
    expect(hit).not.toBeNull();
    expect(hit.corrected).toBe('Midvale');
  });

  test('applySttCorrections replaces phrase case-insensitively', () => {
    saveCorrection({ sourceHeard: 'mid vail', corrected: 'Midvale', lang: 'en' });
    expect(applySttCorrections('Patient lives in Mid Vail Utah', 'en')).toBe(
      'Patient lives in Midvale Utah',
    );
  });

  test('glossary exact match by lang pair', () => {
    saveCorrection({
      sourceHeard: 'How are you feeling today?',
      corrected: '¿Cómo se siente hoy?',
      lang: 'en',
      targetLang: 'es',
      kind: CORRECTION_KIND.GLOSSARY,
    });
    const hit = findGlossaryTranslation('how are you feeling today?', 'en', 'es');
    expect(hit?.corrected).toBe('¿Cómo se siente hoy?');
  });

  test('export import round trip', () => {
    saveCorrection({ sourceHeard: 'julio', corrected: 'Julio', lang: 'es' });
    const exported = exportCorrections();
    clearCorrections();
    expect(loadCorrections()).toHaveLength(0);
    const result = importCorrections(exported);
    expect(result.imported).toBe(1);
    expect(findCorrection('julio', 'es')?.corrected).toBe('Julio');
  });

  test('storage key constant', () => {
    expect(CORRECTIONS_STORAGE_KEY).toBe('catint_corrections_v1');
  });
});
