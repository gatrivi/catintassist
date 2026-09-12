import {
  MANUAL_CALL_OK_STORAGE,
  buildRouteFingerprint,
  loadManualCallOk,
  isManualCallOk,
  setManualCallOk,
} from './routeVerification';

describe('routeVerification', () => {
  beforeEach(() => {
    localStorage.removeItem(MANUAL_CALL_OK_STORAGE);
  });

  test('buildRouteFingerprint combines clip sink mic', () => {
    expect(buildRouteFingerprint('greeting_en', 'sink-a', 'mic-b')).toBe(
      'greeting_en|sink-a|mic-b',
    );
  });

  test('time-of-day variants share one route proof (v4.104.0)', () => {
    expect(buildRouteFingerprint('opener_morning', 's', 'm')).toBe('opener|s|m');
    expect(buildRouteFingerprint('opener_afternoon', 's', 'm')).toBe('opener|s|m');
    expect(buildRouteFingerprint('opener_evening', 's', 'm')).toBe('opener|s|m');
    let store = loadManualCallOk();
    store = setManualCallOk(store, 'opener_morning', 'sink1', 'mic1');
    // proof survives the slot rollover…
    expect(isManualCallOk(store, 'opener_afternoon', 'sink1', 'mic1')).toBe(true);
    // …but a different clip family still needs its own proof.
    expect(isManualCallOk(store, 'closer_afternoon', 'sink1', 'mic1')).toBe(false);
  });

  test('isManualCallOk false until set', () => {
    const store = loadManualCallOk();
    expect(isManualCallOk(store, 'greeting_en', 'sink1', 'mic1')).toBe(false);
  });

  test('setManualCallOk persists fingerprint', () => {
    let store = loadManualCallOk();
    store = setManualCallOk(store, 'greeting_en', 'sink1', 'mic1');
    expect(isManualCallOk(store, 'greeting_en', 'sink1', 'mic1')).toBe(true);
    expect(isManualCallOk(loadManualCallOk(), 'greeting_en', 'sink1', 'mic1')).toBe(true);
  });

  test('sink change invalidates proof', () => {
    let store = loadManualCallOk();
    store = setManualCallOk(store, 'greeting_en', 'sink1', 'mic1');
    expect(isManualCallOk(store, 'greeting_en', 'sink2', 'mic1')).toBe(false);
  });

  test('mic change invalidates proof', () => {
    let store = loadManualCallOk();
    store = setManualCallOk(store, 'greeting_en', 'sink1', 'mic1');
    expect(isManualCallOk(store, 'greeting_en', 'sink1', 'mic2')).toBe(false);
  });
});
