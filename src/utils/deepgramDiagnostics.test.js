import {
  classifyDeepgramClose,
  buildFailureMessage,
  isLikelyAuthClose,
  shouldRetryConnectClose,
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

  test('shouldRetryConnectClose: transient closes retry, auth/quota do not (v4.103.2)', () => {
    // Transient handshake/network drops — the manual-ZAP cases.
    expect(shouldRetryConnectClose(1006, '')).toBe(true);
    expect(shouldRetryConnectClose(1015, '')).toBe(true);
    expect(shouldRetryConnectClose(1000, 'normal')).toBe(false);
    // Auth by reason text is terminal.
    expect(shouldRetryConnectClose(4004, 'Unauthorized')).toBe(false);
    expect(shouldRetryConnectClose(1006, 'Invalid token')).toBe(false);
    expect(shouldRetryConnectClose(3000, 'HTTP 403')).toBe(false);
    // Quota/billing is terminal.
    expect(shouldRetryConnectClose(4000, 'quota exceeded')).toBe(false);
    expect(shouldRetryConnectClose(4000, 'Insufficient balance')).toBe(false);
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
