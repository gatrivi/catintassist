/**
 * Live day-rollover (v4.99.0) — PURE helper, no React/storage imports.
 * A tab left open across midnight must archive the closing day exactly like the
 * mount-time logic in SessionContext does: worked minutes → daily log,
 * timeline → history, daily counters zeroed, lastDate advanced.
 */

/**
 * @returns null when no rollover is due (same day / unknown lastDate),
 * otherwise { dailyLog, historyTimeline, stats, archived }.
 */
export const rollDaySnapshot = ({ stats = {}, dailyLog = {}, historyTimeline = {}, timeline = [], todayStr }) => {
  const lastDate = stats.lastDate;
  if (!lastDate || lastDate === todayStr) return null;

  const nextLog = { ...dailyLog };
  if ((stats.dailyMinutes || 0) > 0) nextLog[lastDate] = Math.round(stats.dailyMinutes);

  const nextHistory = { ...historyTimeline };
  if (timeline.length > 0) nextHistory[lastDate] = timeline;

  return {
    dailyLog: nextLog,
    historyTimeline: nextHistory,
    stats: {
      ...stats,
      dailyMinutes: 0,
      dailyBreakMinutes: 0,
      dailyAvailMinutes: 0,
      callsToday: 0,
      dayStartTime: null,
      lastBreakEndTime: null,
      lastDate: todayStr,
    },
    archived: { date: lastDate, minutes: Math.round(stats.dailyMinutes || 0), segments: timeline.length },
  };
};
