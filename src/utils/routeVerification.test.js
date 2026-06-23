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
    expect(buildRouteFingerprint('greeting_en_morning', 'sink-a', 'mic-b')).toBe(
      'greeting_en_morning|sink-a|mic-b',
    );
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
