# 📊 Scoreboard Implementation Status
Updated: 2026-04-06 (v3.7.0 — Smart Grid)

## NAMING CONVENTION (use these to avoid confusion)
- **BOUNTY** — Remaining ARS to earn today to hit daily quota
- **DAY CASH** — ARS banked today vs today's quota
- **MONTH CASH** — Total ARS earned this month vs ladder goal
- **PACE ETA** — Predicted clock time when you'll hit today's goal at current rate
- **QUALITY** — % of ideal daily pace achieved so far (100% = perfectly on track)
- **STREAK** — Consecutive days meeting the daily goal

---

### THE SIX SMART METRICS (The "Engine")
The central 2x3 grid is split into two rows:
- **Row 1 (💰 Money)**: What you have, what you need. Green tint.
- **Row 2 (🧠 Intelligence)**: What it means, where you're heading. Blue tint.

#### 💰 THE MONEY ROW (Top — Emerald Tint)
1. **BOUNTY** (🏹): Remaining ARS to earn today. Turns ✅ green when goal met. Most actionable number.
2. **DAY CASH** (☀️💰): Banked ARS vs daily quota. 
3. **MONTH CASH** (🗓️💰): Total monthly ARS vs ladder milestone goal.

#### 🧠 THE INTELLIGENCE ROW (Bottom — Blue Tint)
4. **PACE ETA** (🎯): Predicted goal-hit time based on current earned-per-shift-minute rate. Green = before 18:00. Amber = running late.
5. **QUALITY** (📈): % of ideallinear pace. 100% = on track. <80% = speed up. >100% = ahead of pace.
6. **STREAK** (🔥): Consecutive days meeting the daily goal. Yellow at 1+, orange at 3+. Resets to 0 on a miss.

---

### MINI-STATS (Left Sidebar of condensed view)
- **Shift Started** (🏃): Calculated from first `Connect` or `Break End`.
- **Sprint Duration** (🔋): Time active without breaks. WARNING turns red past 2hrs.
- **Compensated Log-Off** (🚪): Shifts 18:00 cutoff based on late start + total breaks.
- **Connection Controls** (🟢/🛑/☕/🌙/⚡): One-touch toggles.

### SMART PILLS (Right Sidebar of condensed view)
- **CALL RATE** (📞): `N calls × avg Xm` — tells you if you're doing short or long calls.
- **EFFECTIVE RATE** (⚡): `AR$/hour` earned including avail and break overhead. Better than posted rate.

---

### TRACKED DATA (SessionContext stats object)
- `dailyMinutes` — talk-time banked today
- `dailyBreakMinutes` — break time today
- `dailyAvailMinutes` — avail time today
- `monthlyMinutes` — total banked this month
- `goalMinutes` — monthly ladder target
- `callsToday` — number of calls completed today (NEW v3.7)
- `streak` — consecutive good days (NEW v3.7)
- `dayStartTime` — timestamp of first Connect today
- `lastDate` — date string for rollover detection

### DATA PERSISTENCE
- All stats stored in `localStorage` under `catintassist_stats`
- Daily counters (dailyMinutes, callsToday) reset on new day detection
- Streak persists across days, only resets if daily goal was NOT met on endDay()

### WORKDAY LOGIC
- **Ideal Shift**: 9:00–18:00 core, absolute 23:00 cutoff
- **Quality Score**: Ideal = linear progress over 480-min (8hr) shift
- **Pace ETA**: `remaining_mins / (banked_mins / shift_elapsed_mins)`
- **Effective Rate**: `dailyARS / shiftElapsedMins * 60`

### ROLLBACK REFERENCE
- v3.6.2 (Watermark Grid): Old grid was Cash Row + Mins Row (redundant pairings)
- Snapshot commit: `df7652e`