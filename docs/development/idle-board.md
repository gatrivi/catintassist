# Idle board — goals + live performance + month calendar (PROPOSAL, 10-22)

Status: **awaiting GO**. Nothing built yet.

## Ask (user, 10-22)
- Review my calendar easily while idle.
- See my goals while idle.
- Live performance report while idle, to organise the rest of the day.

## Where
Off-call pane = `src/components/OffCallWorkspace.js` (`.interpret-pane-idle`, the ~80% area).

## From → to
| Today (idle pane) | Proposed |
|---|---|
| status lines | status lines (unchanged) |
| vocabulary cue cards (`StudyCueCards variant="idle"`) | **behind a toggle** (hide/show rule), default OFF |
| — | **1. Goal line:** `Do X/day for Y days → you reach Z · today is day P · you have Q · goal R` (same maths as `#dial-plain-answer`, v4.192.0) |
| — | **2. Today, live:** minutes + AR$ today vs needed today · calls today · avg call length · time since last call · break left |
| — | **3. Month calendar:** reuse `MonthCalendarPanel` (already in 🎯 Goal Tracking), read-only here |
| mic verify panel | unchanged |

## Open question
"Calendar" = the month minutes-per-day calendar above, or Google Calendar? Assumed the first.

## Rules
- 900×600 must fit without scrolling past the goal line.
- Reuse `computeCatchUp` / `monthBasis` — no second pace maths.
- Every new block shows the version label.
