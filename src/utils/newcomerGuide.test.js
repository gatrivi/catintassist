import {
  isNewcomerGuideDismissed,
  dismissNewcomerGuidePermanent,
  isNewcomerGuideSnoozed,
  snoozeNewcomerGuide,
  unsnoozeNewcomerGuide,
} from './newcomerGuide';

describe('newcomerGuide', () => {
  beforeEach(() => {
    localStorage.removeItem('catint_newcomer_dismissed');
    localStorage.removeItem('catint_newcomer_snoozed');
  });

  test('not dismissed by default', () => {
    expect(isNewcomerGuideDismissed()).toBe(false);
  });

  test('permanent dismiss persists', () => {
    dismissNewcomerGuidePermanent();
    expect(isNewcomerGuideDismissed()).toBe(true);
  });

  test('snooze is session-visible but not permanent', () => {
    expect(isNewcomerGuideSnoozed()).toBe(false);
    snoozeNewcomerGuide();
    expect(isNewcomerGuideSnoozed()).toBe(true);
    unsnoozeNewcomerGuide();
    expect(isNewcomerGuideSnoozed()).toBe(false);
  });

  test('permanent dismiss clears snooze state', () => {
    snoozeNewcomerGuide();
    expect(isNewcomerGuideSnoozed()).toBe(true);
    dismissNewcomerGuidePermanent();
    expect(isNewcomerGuideSnoozed()).toBe(false);
    expect(isNewcomerGuideDismissed()).toBe(true);
  });
});
