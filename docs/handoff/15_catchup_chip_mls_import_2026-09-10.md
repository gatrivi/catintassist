# 15 — Catch-Up Clarity + Chip Narrow-Fit + MLS Import (2026-09-10)

**Status: DONE & PUSHED.** v4.96.2 live on master (`dc2ad20`). Tests green (482), build green. 2/4 pushes used this hour.

## What shipped

**v4.96.0 — Catch-up clarity** (`a85ac42`)
- New util `src/utils/catchUpPlan.js` (+ tests): single source of truth for month-pace deficit. `expectedByToday = goalMinutes/daysInMonth × day`; catch-up spread over remaining days; verdict `on-track | fits-by-18 | needs-ot | impossible`.
- `DailyTargetsChip`: 4th always-visible pair `📉 −XhYm` (red) / `📈 +XhYm` (green), hidden within ±30m of pace. Chip's daily target now uses dial goal (`stats.goalMinutes`), not the hardcoded $1200 estimate (≈9231m) — chip/dashboard/daily bar now agree.
- `DashboardHeader`: DEFICIT tooltip → visible catch-up strip above Weekly Ladder: `📉 BEHIND X · today → Y (off ≈ HH:MM) · then Z/day × Nd` + verdict; impossible → `→ adapt to Nm` (reuses `qualityScore.suggestedGoal`).
- Release notes entry (`4.96.0`), bilingual.

**v4.96.2 — Chip narrow-window fit** (`dc2ad20`)
- Bug: chip is nowrap/flexShrink:0 → below ~850px its tail (☕/📉) painted over `STT:FAST`/`EN|ES` buttons.
- Fix in `DailyTargetsChip.js`: hidden always-full measurer span (exact same pair JSX/styles) → `fitLevel` is a pure function of constraining box width (`.session-controls-center`), recomputed every render (1Hz ticker self-heals) + RO + window resize. fitLevel 1 hides ☕, 2 hides 💵; ⏱+📉 always stay. Hover tooltip keeps all rows.
- **Gotcha for future agents:** do NOT compute fitLevel from `chip.offsetWidth - parent.clientWidth` with setState in useLayoutEffect without a deterministic measure — it oscillates → "Maximum update depth exceeded" → ErrorBoundary blank app on resize. The measurer span is the pattern.
- Verified in-browser: DOM overlap scan at 900/800/700/620, 3 sweeps, 0 overlaps, 0 console errors.

**MLS Sep 1–9 import pack** (`91a407c`, local + pushed)
- `exports/mls-import-sep2026/call-log-paste.txt` — 68 rows transcribed from `Documents\0mls\20-09-Sep` screenshots; verified vs `parseCallLogText`+`groupCallsByDay` by `src/utils/mlsSepImportVerify.test.js` (kept as regression guard: day totals 181/69/193/202/179/157, 0 skipped).
- **PENDING USER ACTION:** paste file into Settings → Data → Company call log import → Apply (idempotent, +982m for Sept).

## Known data caveats (in `exports/mls-import-sep2026/README.md`)
- Sep 1 + 2 platform tables scroll-truncated → one filler row each (customer ID `0`, 09:00 AM, +135m/+29m) tops minutes to exact header totals; per-call detail for those 2 days approximate.
- Sep 2 banks 69 not 70 (one real 1-min call is non-billable; app banks billable only).

## Pre-existing bug found (not fixed, out of scope)
- `SessionContext.commitDayToLog` (heatmap day editor) writes `dailyLog` only — does NOT sync `stats.monthlyMinutes`, so heatmap edits never move the scoreboard/deficit. Only `importCallLog` and `adjustDailyMinutes` do. Fix candidate for a future session.

## Files touched this session
`src/utils/catchUpPlan.js` (+test) · `src/utils/mlsSepImportVerify.test.js` · `src/components/DailyTargetsChip.js` · `src/components/DashboardHeader.js` (chip props + catch-up strip) · `src/constants/version.js` · `src/content/releaseNotes.js` · `exports/mls-import-sep2026/*`

## Do not touch
- Other agent's v4.96.1 habit-toast work (`e258a6f`) — shipped, separate spec (#14).
- `callLogImport.js` merge semantics (company log = source of truth, idempotent deltas) — do not "simplify".
