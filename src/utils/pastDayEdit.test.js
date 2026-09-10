import { isDateInCurrentMonth, applyDayEditToStats } from './pastDayEdit';

describe('pastDayEdit', () => {
  const SEP10 = new Date('2026-09-10T12:00:00');

  it('detects current-month dates only', () => {
    expect(isDateInCurrentMonth('Thu Sep 10 2026', SEP10)).toBe(true);
    expect(isDateInCurrentMonth('Tue Sep 01 2026', SEP10)).toBe(true);
    expect(isDateInCurrentMonth('Fri Oct 02 2026', SEP10)).toBe(false);
    expect(isDateInCurrentMonth('garbage', SEP10)).toBe(false);
  });

  it('applies the delta to monthly + weekly, floored at 0', () => {
    const stats = { monthlyMinutes: 981, weeklyMinutes: 300 };
    const up = applyDayEditToStats(stats, { oldMinutes: 0, newMinutes: 181, isCurrentMonth: true });
    expect(up).toEqual({ monthlyMinutes: 1162, weeklyMinutes: 481 });
    const down = applyDayEditToStats({ monthlyMinutes: 100, weeklyMinutes: 50 }, { oldMinutes: 181, newMinutes: 0, isCurrentMonth: true });
    expect(down).toEqual({ monthlyMinutes: 0, weeklyMinutes: 0 }); // floored, not negative
  });

  it('leaves stats untouched for other-month days', () => {
    const stats = { monthlyMinutes: 981, weeklyMinutes: 300 };
    expect(applyDayEditToStats(stats, { oldMinutes: 0, newMinutes: 500, isCurrentMonth: false }))
      .toEqual({ monthlyMinutes: 981, weeklyMinutes: 300 });
  });
});
