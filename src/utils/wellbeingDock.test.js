import { isWellbeingDockEnabled, setWellbeingDockEnabled } from './wellbeingDock';

describe('wellbeingDock', () => {
  beforeEach(() => {
    localStorage.removeItem('catint_personal_dock');
  });

  test('hidden by default', () => {
    expect(isWellbeingDockEnabled()).toBe(false);
  });

  test('remembers user choice', () => {
    setWellbeingDockEnabled(true);
    expect(isWellbeingDockEnabled()).toBe(true);
  });
});
