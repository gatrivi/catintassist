import { getNudgeLevel, recordNudgeShown, acknowledgeNudge, getNudgePresentation } from './wellbeingNudges';

describe('wellbeingNudges', () => {
  beforeEach(() => {
    localStorage.removeItem('catint_wellbeing_nudge_desk');
  });

  test('escalates on repeated ignores', () => {
    expect(getNudgeLevel('desk')).toBe(0);
    recordNudgeShown('desk');
    expect(getNudgeLevel('desk')).toBe(1);
    recordNudgeShown('desk');
    recordNudgeShown('desk');
    expect(getNudgePresentation('desk', 'Break').persistent).toBe(true);
    acknowledgeNudge('desk');
    expect(getNudgeLevel('desk')).toBe(0);
  });
});
