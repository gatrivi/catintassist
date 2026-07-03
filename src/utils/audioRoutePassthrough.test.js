import {
  ROUTE_MODE,
  readRouteModePreference,
  writeRouteModePreference,
} from './audioRoutePassthrough';

describe('audioRoutePassthrough prefs', () => {
  beforeEach(() => {
    localStorage.removeItem('CATINT_ROUTE_MODE');
  });

  test('defaults to passthrough', () => {
    expect(readRouteModePreference()).toBe(ROUTE_MODE.PASSTHROUGH);
  });

  test('persists dual_element when set', () => {
    writeRouteModePreference(ROUTE_MODE.DUAL_ELEMENT);
    expect(readRouteModePreference()).toBe(ROUTE_MODE.DUAL_ELEMENT);
  });

  test('invalid value falls back to passthrough', () => {
    localStorage.setItem('CATINT_ROUTE_MODE', 'bogus');
    expect(readRouteModePreference()).toBe(ROUTE_MODE.PASSTHROUGH);
  });
});
