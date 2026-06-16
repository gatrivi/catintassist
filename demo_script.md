# Redirect (v4.48.2)
This doc moved to `docs/archive/demo-script.md`.

<details><summary>Legacy (kept for reference)</summary>

# 🐾 CatIntAssist: 60-Second Demo Showcase Plan

This script is designed to highlight the high-value features of the CatIntAssist application in a fast-paced, visually impressive 60-second window. It focuses on the sleek UI, real-time AI transcription, and gamified dopamine hooks.

## 🎬 Pre-Demo Setup
1. **Environment:** Ensure `.env` is configured with a valid Deepgram API key.
2. **Audio:** Have a simulated "call" audio ready (e.g., a fast-paced English medical scenario followed by a Spanish response).
3. **Screen:** Open the app on a desktop browser. Set the volume so the soundscape (coins, purse opening) is clearly audible.

---

## ⏱️ Script & Choreography

### Part 1: The Setup & Gamification (0:00 - 0:15)
*   **Visual Focus:** The sleek right-side Dashboard (`DashboardHeader.js`).
*   **Action:** 
    *   Click on the Daily Goal metric to open the `DialGoalSelector`.
    *   Scroll the dial up to set a high target (e.g., 400m).
    *   Save it and watch the `RollingNumber` smoothly calculate and roll up the AR$ Earnings potential.
*   **Narrative Hook:** "CatIntAssist turns grueling shifts into a game. Set your daily goal, and the UI instantly visualizes your earning potential with satisfying, mechanical counter animations."

### Part 2: The Core Engine (0:15 - 0:35)
*   **Visual Focus:** The main Transcription Board (`TranscriptionBoard.js`).
*   **Action:**
    *   Click the "Play" (Connect) button. 
    *   **Audio Cue:** *[Purse Opening Sound]* plays, indicating the livestream is active.
    *   Start the simulated audio: Have an English speaker read a fast medical scenario. Watch the Blue text flow in real-time via Deepgram.
    *   Simulate a Spanish response. Switch the language toggle (or let auto-detect run if configured), watching the Green text populate.
    *   **Action:** Hover over a transcribed phone number or medical ID to show the `phone-number` highlight class, and click to copy.
*   **Narrative Hook:** "Powered by Deepgram Nova-2, transcription is instantaneous and color-coded. Smart data extraction catches phone numbers on the fly, preventing critical data loss under pressure."

### Part 3: Interpreter Aids in Action (0:35 - 0:45)
*   **Visual Focus:** Transcription Bubbles and `DictionaryTool.js`.
*   **Action:** 
    *   Continue the simulated audio, letting one speaker talk continuously without a break.
    *   Watch the word count on the active bubble climb. As it hits 40 words, observe the **Long Bubble Warning** (text turns warning orange/red, and a soft ping plays).
    *   **Action:** Double-click a complex medical term in the transcript. The `DictionaryTool` popover instantly appears with the translation.
*   **Narrative Hook:** "It actively coaches you. If a speaker goes on too long, a subtle warning prevents memory overload. Stuck on a term? Instant dictionary lookup without leaving the window."

### Part 4: The Payout (0:45 - 1:00)
*   **Visual Focus:** Full Screen & Scoreboard.
*   **Action:** 
    *   Click the "Stop" button to end the session.
    *   **Audio/Visual Cue:** The *[Crash of Coins]* sound effect plays.
    *   The massive `CelebrationParticles` trigger, raining gold/silver coins and cash emojis down the screen.
    *   The `GameScoreboard` locks in the final session earnings with a final `RollingNumber` flourish.
*   **Narrative Hook:** "When the call ends, the dopamine hits. Immersive soundscapes and visual celebrations lock in your earnings, keeping you motivated for the next connection."

---

## 🛠️ Verification Checklist for Demo Readiness
- [x] **RollingNumbers**: Verified stable and fluid after recent refactor.
- [x] **DialGoalSelector**: Verified it updates the AR$ math accurately.
- [x] **Deepgram STT**: WebSockets connection logic is intact.
- [x] **Long Bubble Warning**: Logic confirmed in `TranscriptionBoard.js` (`wordCount >= 40`).
- [x] **Celebration Particles/Audio**: Confirmed triggered on session end.
- [x] **Dictionary Tool**: Popover logic confirmed.

</details>