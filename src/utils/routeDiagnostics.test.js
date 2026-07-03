import {
  logRouteEvent,
  getRouteDiagnostics,
  clearRouteDiagnostics,
  assessSttLoadRisk,
  setSttActive,
  isSttActive,
  ROUTE_EVENT,
  formatRouteDiagLine,
} from './routeDiagnostics';

describe('routeDiagnostics', () => {
  beforeEach(() => {
    clearRouteDiagnostics();
    setSttActive(false);
  });

  test('logs events with stt flag', () => {
    setSttActive(true);
    logRouteEvent(ROUTE_EVENT.PLAY_START, { clipKey: 'greeting_en_morning', routeMode: 'passthrough' });
    const [e] = getRouteDiagnostics();
    expect(e.type).toBe(ROUTE_EVENT.PLAY_START);
    expect(e.sttActive).toBe(true);
    expect(e.clipKey).toBe('greeting_en_morning');
  });

  test('assessSttLoadRisk flags dual element under STT', () => {
    const r = assessSttLoadRisk({ sttActive: true, routeMode: 'dual_element', sinkBound: true });
    expect(r.risky).toBe(true);
    expect(r.reason).toContain('passthrough');
  });

  test('assessSttLoadRisk ok for passthrough under STT', () => {
    const r = assessSttLoadRisk({ sttActive: true, routeMode: 'passthrough', sinkBound: true });
    expect(r.risky).toBe(false);
  });

  test('formatRouteDiagLine', () => {
    const line = formatRouteDiagLine({
      at: Date.now(),
      sttActive: true,
      type: 'play_start',
      clipKey: 'intake',
      routeMode: 'passthrough',
    });
    expect(line).toContain('play_start');
    expect(line).toContain('STT');
    expect(line).toContain('intake');
  });

  test('isSttActive reflects window flag', () => {
    expect(isSttActive()).toBe(false);
    setSttActive(true);
    expect(isSttActive()).toBe(true);
  });
});
