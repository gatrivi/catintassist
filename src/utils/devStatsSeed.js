/**
 * Dev-only stats seed (v4.86.6) — localhost only.
 * Hardcodes today's real call history into `catintassist_stats` so the
 * progress bars are meaningful on a fresh local browser.
 *
 * 2026-09-03: 15 calls = 172 minutes (10:16–16:33).
 * Apply-once per seed id; adjust SEEDS below and bump the id for new days.
 */
const SEED_FLAG = 'catint_dev_seed_applied_2026_09_03';
const SEED = {
  dateStr: new Date(2026, 8, 3).toDateString(), // Sep 3 2026
  minutes: 172,
  calls: 15,
};

export function applyDevStatsSeed() {
  try {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    if (localStorage.getItem(SEED_FLAG)) return;
    if (new Date().toDateString() !== SEED.dateStr) return; // seed only on its day
    const raw = localStorage.getItem('catintassist_stats');
    const stats = raw ? JSON.parse(raw) : {};
    const prevDaily = Number(stats.dailyMinutes) || 0;
    stats.dailyMinutes = Math.max(prevDaily, SEED.minutes);
    // Monthly absorbs only the difference not already counted.
    stats.monthlyMinutes = Math.max(0, (Number(stats.monthlyMinutes) || 0) + (SEED.minutes - prevDaily));
    stats.callsToday = Math.max(Number(stats.callsToday) || 0, SEED.calls);
    stats.lastDate = stats.lastDate || SEED.dateStr;
    if (!stats.dayStartTime) stats.dayStartTime = new Date(SEED.dateStr).setHours(9, 0, 0, 0);
    localStorage.setItem('catintassist_stats', JSON.stringify(stats));
    localStorage.setItem(SEED_FLAG, '1');
  } catch (_) { /* never block app startup */ }
}
