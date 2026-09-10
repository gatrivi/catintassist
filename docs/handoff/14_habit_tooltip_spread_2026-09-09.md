# 14 · Habit-dock tooltips/toasts spread (SHIPPED v4.96.1, 2026-09-10)

## Status: SHIPPED v4.96.1 — fan-out + stuck-toast fix together

## Problem
Habit-dock tooltips + nudge toasts piled in one spot above the dock:
- `.habit-dock-pill[data-tooltip]::after` had NO CSS rule (selector only covered
  `> button` and `.workspace-view-btn`, but pills sit inside wrapper divs) —
  plus ChoreTracker's pill button was missing the `habit-dock-pill` class entirely.
- Nudge toasts used ad-hoc `left: 52px` + staggered `pillBottom` (52/98/144px) —
  a vertical pile over the transcript instead of using horizontal space.

## Fixes (uncommitted tree)
- `src/index.css`: tooltip `::after` rules extended to `.habit-dock-pill`;
  edge fan-out (first pill anchors left, last anchors right, middle centered)
  for both tooltips and new shared `.habit-toast` class (per-pill anchor,
  single row above dock, `nowrap`, `pointer-events: none`).
- 4 trackers (`DeskExercise`, `Rosary`, `Meal`, `Chore`): toasts switched to
  `className="habit-toast"` with only color inline; `pillBottom` consts removed.
- `ChoreTrackerWidget.js`: pill button gained `className="habit-dock-pill"`.

## Verification
- `npm test` 21/21 green; `npm run build` clean. No new tests (CSS-only + class moves).

## Next agent
- ~~Bump to v4.95.5~~ Done as **v4.96.1** (repo was already at 4.96.0): fan-out CSS +
  stuck-toast fix shipped together — `wellbeingNudges.js` level 3 is now
  `persistent: false, durationMs: 15000`; all 4 pill onClicks call `setToast(null)`;
  `isActive` effect clears toasts on call start; dead `hasPersistentWellbeingAlert` removed.
- Watch in prod: with 2+ simultaneous nudges, toasts sit side-by-side per pill —
  pills are ~46px apart so wide toasts may still touch; edge fan-out covers ends.
