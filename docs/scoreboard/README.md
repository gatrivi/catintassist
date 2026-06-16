# Scoreboard (v4.48.2)

## 20/80 rule (hard constraint)
- Scoreboard occupies top ~20% of viewport height.
- Transcription + translation uses the remaining ~80%.

## Core layout / components
- High-density grid layout (condensed view).
- “Momentum” / ghost vs actual progress.
- Idle drift + pace prediction when off-call.

## Naming convention
Use these to avoid confusion:
- **BOUNTY** — Remaining ARS to earn today to hit daily quota
- **DAY CASH** — ARS banked today vs today's quota
- **MONTH CASH** — Total ARS earned this month vs ladder goal
- **PACE ETA** — Predicted clock time when you'll hit today's goal at current rate
- **QUALITY** — % of ideal daily pace achieved so far (100% = perfectly on track)
- **STREAK** — Consecutive days meeting the daily goal

## The six smart metrics (“Engine”)
Central grid split into two rows:
- **Row 1 (💰 Money)**: what you have / what you need (green tint)
- **Row 2 (🧠 Intelligence)**: what it means / where you're heading (blue tint)

1. **BOUNTY** (🏹)
2. **DAY CASH** (☀️💰)
3. **MONTH CASH** (🗓️💰)
4. **PACE ETA** (🎯)
5. **QUALITY** (📈)
6. **STREAK** (🔥)

## Mini-stats (condensed sidebars)
- **Shift Started** (🏃)
- **Sprint Duration** (🔋)
- **Compensated Log-Off** (🚪)
- **Connection Controls** (🟢/🛑/☕/🌙/⚡)
- **CALL RATE** (📞): `N calls × avg Xm`
- **EFFECTIVE RATE** (⚡): `AR$/hour` earned including avail + break overhead

## Tracked data (SessionContext stats)
- `dailyMinutes`
- `dailyBreakMinutes`
- `dailyAvailMinutes`
- `monthlyMinutes`
- `goalMinutes`
- `callsToday`
- `streak`
- `dayStartTime`
- `lastDate`

## Data persistence
- Stored in `localStorage` under `catintassist_stats`
- Daily counters reset on new day detection
- Streak resets only if daily goal was NOT met on `endDay()`

## Workday logic
- Ideal Shift: 9:00–18:00 core, absolute 23:00 cutoff
- Pace ETA uses remaining minutes and observed banked rate

## Scoreboard glossary (12-metric “at a glance” mode)
1. MINS TODAY
2. LEFT TODAY
3. TODAY GOAL
4. $ TODAY
5. $ LEFT TODAY
6. $ MONTH
7. $ LEFT MONTH
8. BREAK USED
9. MO AVG
10. REQ TO MIN
11. REQ TO LVL2
12. CURR CALL

Quick rules:
- Resets happen at midnight (00:00)
- Avail time is only tracked between 9 AM and 11:59 PM

If you need the old gamified layout, click “RETURN TO GAMIFIED VIEW” at the bottom of the grid.


