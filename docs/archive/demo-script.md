# Legacy: 60-Second Demo Showcase Plan

This script is designed to highlight the high-value features of the CatIntAssist application in a fast-paced, visually impressive 60-second window.

## Pre-Demo Setup
1. Ensure `.env` is configured with a valid Deepgram API key.
2. Have simulated “call” audio ready (English → Spanish).
3. Open the app on desktop; set volume so soundscape is audible.

---
## Script & Choreography
### Part 1 (0:00 - 0:15): Setup & Gamification
- Click Daily Goal metric → open `DialGoalSelector`
- Scroll dial to set a high target (ex: 400m)
- Watch `RollingNumber` calculate AR$ earnings potential

### Part 2 (0:15 - 0:35): Core Engine
- Click `Connect` (“Play”) button
- Purse opening sound plays; start tab audio
- Speak EN: watch white/blue flow via Deepgram
- Speak ES: watch lanes populate by detected language
- Hover/click phone numbers to copy

### Part 3 (0:35 - 0:45): Interpreter aids
- Watch word count; at 40 words observe the long bubble warning
- Double-click complex medical term → dictionary popover

### Part 4 (0:45 - 1:00): Payout
- Click `Stop`
- Crash of Coins plays, celebration particles rain coins/cash emojis
- `GameScoreboard` locks final session earnings

---
## Verification checklist
- RollingNumbers
- DialGoalSelector
- Deepgram STT
- Long Bubble Warning (`wordCount >= 40`)
- Celebration Particles/Audio
- Dictionary Tool

