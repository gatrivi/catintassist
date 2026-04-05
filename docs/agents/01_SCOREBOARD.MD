# 📊 Scoreboard Implementation Status
Updated: 2026-04-05 (v3.6.2)

### THE SIX CORE GRID METRICS (The "Engine")
The central 2x3 grid consists of two distinct horizontal modules. Recognition is based on **Target Tinting** (Background Color) rather than text.

#### 💵 THE CASH MODULE (Top Row - Emerald Tint)
1. **CALL CASH**: Current live session earnings. (📞💰)
2. **DAY CASH**: Banked ARS vs today's target quota. (☀️💰)
3. **MONTH CASH**: Total monthly income vs the ladder goal. (🗓️💰)

#### 🕒 THE MINUTES MODULE (Bottom Row - Blue Tint)
4. **CALL MINS**: Elapsed minutes in active session. (📞🕒)
5. **DAY MINS**: Today's talk-time vs required daily pacing. (☀️🕒)
6. **MONTH MINS**: Progress on the 16,500m "Legend" ladder. (🗓️🕒)

### DESIGN HIERARCHY
- **Context Over Numbers**: Emojis are boosted to 35% opacity to serve as "Row/Column Signposts."
- **Dimmed Values**: Numerical data is set to 75% white to reduce visual "vibrancy" and allow the context icons to shine through.

#### [x] MINI-STATS (Left Sidebar)
- [x] **Shift Started**: (🏃) Calculated from first `Connect` or `Break` end.
- [x] **Sprint Duration**: (🔋) Time active without breaks. [Pill]
- [x] **Compensated Log-Off**: (🚪) Shifts 18:00 cutoff based on late start and total breaks taken. [Pill]
- [x] **Connection Controls**: (🟢/🛑/☕/🌙/⚡) One-touch toggles for Connect, Stop, Break, End Day, and Stream Zap.

#### [x] CATCH-UP & PACING (Right Sidebar)
- [x] **Cash to Goal**: (🏁) Literal ARS remaining to hit today's daily quota.
- [x] **Shift Segments**: (🌅/☀️/🌙) Estimated workable hours remaining in Morning, Afternoon, and Evening (until 23h).
- [x] **Daily Avg**: Monthly minutes divided by elapsed days.

### WORKDAY LOGIC
- [x] **Shift Hours**: Standard 9:00 - 18:00 core, with an Absolute 23:00 cutoff.
- [x] **Dynamic Log-Off**: Automatically adjusts `Logout` time if login was after 9 AM.
- [x] **Workable Minutes**: Calculations assume **35-55 mins** of actual talk-time per hour (headroom for Avail/Breaks).

### AESTHETICS & INTERACTION
- [x] **Zero-Waste**: Metrics reach the absolute edges.
- [x] **High Density**: Uses watermark emojis to save horizontal space.
- [x] **Copy-on-Click**: Clicking metrics in expanded view copies currency numbers (sanitized for pasting).
- [x] **Silence Guardian**: (v3.6.2) Detects and alerts on silence > 10m to prevent runaway metrics.