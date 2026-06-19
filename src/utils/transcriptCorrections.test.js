import {
  CORRECTIONS_STORAGE_KEY,
  loadCorrections,
  saveCorrection,
  findCorrection,
  exportCorrections,
  importCorrections,
  clearCorrections,
} from './transcriptCorrections';

describe('transcriptCorrections v4.56', () => {
  beforeEach(() => {
    clearCorrections();
  });

  test('save and find exact normalized match', () => {
    saveCorrection({
      sourceHeard: '  Mid Vail  ',
      corrected: 'Midvale',
      lang: 'en',
    });
    const hit = findCorrection('mid vail', 'en');
    expect(hit).not.toBeNull();
    expect(hit.corrected).toBe('Midvale');
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
