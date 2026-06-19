import {
  classifyDeepgramClose,
  buildFailureMessage,
  isLikelyAuthClose,
  FAILURE,
} from './deepgramDiagnostics';

describe('deepgramDiagnostics', () => {
  test('classifies NET-0001 as timeout/audio', () => {
    const d = classifyDeepgramClose(1011, 'NET-0001');
    expect(d.category).toBe(FAILURE.TIMEOUT);
  });

  test('classifies unauthorized reason as auth', () => {
    const d = classifyDeepgramClose(1006, 'Unauthorized');
    expect(d.category).toBe(FAILURE.AUTH);
  });

  test('buildFailureMessage includes key source', () => {
    const msg = buildFailureMessage({
      category: FAILURE.AUTH,
      hint: 'bad key',
      keySource: 'runtime',
      keyMasked: '...abc4',
      socketLang: 'en',
    });
    expect(msg).toContain('API KEY');
    expect(msg).toContain('runtime');
    expect(msg).toContain('[EN socket]');
  });

  test('isLikelyAuthClose for 1006', () => {
    expect(isLikelyAuthClose(1006, '')).toBe(true);
  });
});
