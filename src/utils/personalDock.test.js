import { isPersonalDockEnabled, setPersonalDockEnabled } from './personalDock';

describe('personalDock', () => {
  beforeEach(() => {
    localStorage.removeItem('catint_personal_dock');
  });

  test('hidden by default', () => {
    expect(isPersonalDockEnabled()).toBe(false);
  });

  test('toggle persists in localStorage', () => {
    setPersonalDockEnabled(true);
    expect(isPersonalDockEnabled()).toBe(true);
    setPersonalDockEnabled(false);
    expect(isPersonalDockEnabled()).toBe(false);
  });
});
