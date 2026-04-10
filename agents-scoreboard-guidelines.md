# Scoreboard Glossary & Guidelines

The CatIntAssist Scoreboard is designed to give you clarity, accountability, and encouragement at a glance. It calculates metrics in real-time based on your work minutes, active call time, break usage, and target goals. 

Here is a comprehensive breakdown of every metric, what it means, how it is calculated, and when it resets:

## 1. Condensed View Metrics (The Pills)
- **SHIFT PROGRESS**: 
  - **What it is**: The total real-time elapsed since you first clicked "Connect" today.
  - **Calculation**: Current Time - First Connection Time today.
  - **Resets**: At midnight or when you begin a new day.

- **SPRINT (🔋)**: 
  - **What it is**: The amount of unbroken time since you last started your work day, or since your last coffee break.
  - **Why use it**: Tracks your endurance. A "Sprint" is uninterrupted avail/call time.
  - **Calculation**: Time passed since your day started OR since you clicked "STOP BREAK".
  - **Resets**: Every time you start a coffee break, or at midnight.

- **EST. LOG OFF (🚪)**: 
  - **What it is**: The exact time you should log off to complete your scheduled shift hours, adjusting for late arrivals and break times.
  - **Calculation**: Usually 18:00, but pushes back by your late start (time passed after 9:00 AM) and by the amount of break minutes you've consumed.
  - **Resets**: Every day.

- **CALLS TODAY (📞)**:
  - **What it is**: How many calls you have taken today, and the average duration of those calls.
  - **Calculation**: Current banked calls / Average call time in minutes.
  - **Resets**: Every day at end of day or midnight.

- **EFFECTIVE RATE (⚡)**:
  - **What it is**: The actual AR$ value you are generating per hour of your shift, taking into account the dead time you spent waiting for calls (Avail).
  - **Calculation**: (Total Earnings Today / Shift Progress Minutes) * 60.

## 2. Expanded Dashboard Metrics (The Cards)

### Upper Row - High-Level Progress
- **TODAY'S BOUNTY**: The remaining AR$ you need to earn today to hit your daily goal. Once it hits green/check, you have completed the day's minimum requirement.
- **MO. PROFIT**: Your total banked earnings for the month versus your ultimate monthly target.
- **DAILY**: Minutes banked today vs the total minutes you need to reach your daily goal. Also shows the percentage of the day completed.
- **NEXT (PRO LADDER)**: Shows your immediate next target on the 12-step Pro Ladder (each step is 1375m). It is the psychological short-term goal to keep you climbing.

### Middle Row - Smart Intelligence
- **PACE ETA (🎯)**: Predicts the exact clock time you will hit your daily goal if you maintain your current rate of earning minutes relative to your shift time. 
- **QUALITY (📈)**: Measures your pacing against an "ideal" session window. If you are far behind the required pace, it will suggest a more realistic lowered goal (Adapt) to keep it achievable.
- **STREAK (🔥)**: How many consecutive past days you hit your goal, plus an indicator if you're on track to hit today's goal.
- **BREAK LEFT (☕)**: How much of your daily 90-minute coffee break budget remains.

### Lower Row - Call & Footer Metrics
- **CALL**: The active duration of your current, ongoing call. The money shown here is "unbanked" until you press STOP. Resets every time you hit CONNECT.
- **SESSION**: A duplicate of the "SPRINT" pill. Shows duration of the current unbroken work session since the last break.
- **LOGOUT**: A duplicate of the "EST. LOG OFF" pill. It explicitly tells you at what time your shift technically ends to have a full workday completed.

## Core Rules for Data Persistence
- **Midnight Rollover (00:00)**: Any active breaks are auto-stopped. Today's worked minutes are pushed into the Monthly Heatmap, resetting the day. Available windows strictly end at midnight.
- **Avail Time**: Only tracked between 9 AM and 11:59 PM.
- **Cloud Sync**: Removed in favor of strict local browser storage (`localStorage`) to avoid overwriting or zero-state race conditions. 

*Always check the mouse-over (tooltip) on any metric in the app for a quick reminder of these definitions!*