import {
  classifyDeepgramClose,
  buildFailureMessage,
  isLikelyAuthClose,
  classifyDeepgramHealthProbe,
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

  test('health probe: missing key', () => {
    expect(classifyDeepgramHealthProbe({ keyPresent: false }).verdict).toBe('NO_KEY');
  });

  test('health probe: 401 is AUTH_BAD', () => {
    const d = classifyDeepgramHealthProbe({
      keyPresent: true,
      projectsHttp: 401,
      listenHttp: 401,
    });
    expect(d.verdict).toBe('AUTH_BAD');
    expect(d.category).toBe(FAILURE.AUTH);
  });

  test('health probe: green path OK', () => {
    const d = classifyDeepgramHealthProbe({
      keyPresent: true,
      projectsHttp: 200,
      listenHttp: 200,
      wsOk: true,
    });
    expect(d.verdict).toBe('OK');
    expect(d.category).toBe(null);
  });

  test('health probe: WS fail is DEGRADED network', () => {
    const d = classifyDeepgramHealthProbe({
      keyPresent: true,
      projectsHttp: 200,
      listenHttp: 200,
      wsOk: false,
    });
    expect(d.verdict).toBe('DEGRADED');
    expect(d.category).toBe(FAILURE.NETWORK);
  });
});
