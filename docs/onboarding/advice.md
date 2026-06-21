# CatIntAssist — Quick Advice (how to use it)

This page is the “working checklist” for daily use. It’s intentionally short, and it points you to the deeper specs when needed.

## 1) The daily core loop
1. Click `Connect` (green) to attach audio from the interpreter tab.
2. Click `Start interpreting` when the conversation is live.
3. Click `STOP` (red) when the call is done.

If you ever get blocked by browser UI, use `Connect` again (and consider `Mic mode` as a fallback).

## 2) If you’re not ready to connect yet
When you see the “waiting for connect” guidance, you can choose:
- `Got it` (hide nagging for a while)
- `Remind later`
- `Show less`

This is meant for dev/testing and also for real life when the patient queue is delayed.

## 3) Mic mode (fallback)
If tab sharing is annoying/unavailable, turn on `Mic Test` and connect using your microphone.
Mic mode is for when you cannot (or should not) share the browser tab audio.

## 4) Translation rules (so you know what to expect)
- Bubbles split at sentence boundaries (`. ! ?`) and translate per segment.
- If you see weak/bad translations, try re-translation from the bubble rail (↻).
- Phone/SSN/address number sequences are protected against destructive edits.

## 5) Numbers: fastest workflow
- Click highlighted numbers to auto-copy.
- Phone numbers/IDs get digit-group formatting for readability.

## 6) Scoreboard (your daily target)
- Minutes + AR$ money bounties are the main loop numbers.
- Grid percentages show how close you are (all 12 numeric cells).
- **Tap 🎯** in the top toolbar (off-call) to set weekly hours commitment — goal picker wheel.
- Presets: **Min** / **Std** / **Full** in condensed toolbar (900×600 → use Min).
- ✏️ edit mode: hide/show individual grid cells and income cards.
- **Settings → Display** — choose what shows always / on-call / off-call / hidden (progress bars, scoreboard rows, mic meter, etc.).

## 7) Soundboard
- Soundboard Studio is off-call only.
- Use the health-check flow if your greeting doesn’t “legibly” transmit.
- Patient playback routing is still being improved; rely on local test routes for QA.

## 8) Dev shortcuts (optional)
- `Shift + D` cycles demo scenarios.
- In development builds, there is also a “UI In Call Mode (no audio)” helper so you can test call layout without opening browser permission dialogs.

