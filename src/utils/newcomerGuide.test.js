import { isNewcomerGuideDismissed, dismissNewcomerGuidePermanent } from './newcomerGuide';

describe('newcomerGuide', () => {
  beforeEach(() => {
    localStorage.removeItem('catint_newcomer_dismissed');
  });

  test('not dismissed by default', () => {
    expect(isNewcomerGuideDismissed()).toBe(false);
  });

  test('permanent dismiss persists', () => {
    dismissNewcomerGuidePermanent();
    expect(isNewcomerGuideDismissed()).toBe(true);
  });
});
