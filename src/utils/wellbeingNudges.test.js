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
    // v4.96.1: level 3 is never persistent — 15s auto-hide max
    const pres = getNudgePresentation('desk', 'Break');
    expect(pres.persistent).toBe(false);
    expect(pres.durationMs).toBe(15000);
    acknowledgeNudge('desk');
    expect(getNudgeLevel('desk')).toBe(0);
  });
});
