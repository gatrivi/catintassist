/**
 * v4.96.5: hand-edit a past day's minutes (heatmap pebble editor) and keep the
 * scoreboard honest. Editing the log alone used to leave stats.monthlyMinutes
 * behind, so the deficit chip / catch-up plan never saw hand corrections.
 */

/** Is this `Date.toDateString()` inside the month of `now`? */
export const isDateInCurrentMonth = (dateStr, now = new Date()) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/**
 * Stats after a hand edit: past-day delta flows into monthly + weekly
 * (weekly resets with the month in this app), floored at 0 like adjustDailyMinutes.
 * Days outside the current month leave stats untouched.
 */
export const applyDayEditToStats = (stats, { oldMinutes, newMinutes, isCurrentMonth }) => {
  if (!isCurrentMonth) return { monthlyMinutes: stats.monthlyMinutes || 0, weeklyMinutes: stats.weeklyMinutes || 0 };
  const delta = Math.round(newMinutes) - Math.round(oldMinutes);
  return {
    monthlyMinutes: Math.max(0, (stats.monthlyMinutes || 0) + delta),
    weeklyMinutes: Math.max(0, (stats.weeklyMinutes || 0) + delta),
  };
};
