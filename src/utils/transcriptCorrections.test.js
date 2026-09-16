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

  test('v4.115.0: corrections respect word boundaries inside names', () => {
    saveCorrection({ sourceHeard: 'ana', corrected: 'Anna', lang: 'en' });
    expect(applySttCorrections('patient Juana has pain', 'en')).toBe('patient Juana has pain');
    expect(applySttCorrections('ana is here', 'en')).toBe('Anna is here');
  });

  test('v4.115.0: digit corrections do not rewrite inside phone runs', () => {
    saveCorrection({ sourceHeard: '212', corrected: 'two twelve', lang: 'en' });
    expect(applySttCorrections('call 555-1212-3456', 'en')).toBe('call 555-1212-3456');
    expect(applySttCorrections('room 212 please', 'en')).toBe('room two twelve please');
  });
});
