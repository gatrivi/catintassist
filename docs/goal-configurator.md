# Goal configurator (v4.162.0)

The 🎯 wheel. `DialGoalSelector.js` renders inside `GoalTrackingView.js`'s left
pane (it is **not** a modal — `.dial-goal-selector--modal` and the `modal` prop
are dead, no caller passes it).

**Do not change the maths.** `goalAnchor.js` + `catchUpPlan.js` are pure and
carry 42 tests. v4.162.0 changed only the *writes* and the chrome around them.

## The invariant

> Weekly commitment is locked. Daily + monthly follow workdays.

`weeklyMins` (the dial, 20–100h in 5h steps) → `dailyMins = weeklyMins /
daysPerWeek` → `monthlyMins = dailyMins × workDays`.

What gets **banked** is not the full month — it is
`deriveBankTargetMinutes()`: minutes already worked + commitment × workdays
*left*. A goal banked on the 20th never asks for days that are gone.

**Never reverse-derive the commitment from `goalMinutes`.** It is a mid-month
total, so dividing it back out turned a 35h/Wk goal banked on the 20th into
"20h/Wk" and re-banking silently downgraded it. The dial seeds from
`stats.goalPerWorkdayMinutes` via `seedIndexForCommitted()`.

## Every write: preview → confirm → undo

| control | writes | guard |
|---|---|---|
| **Bank Goal** | 5 stat fields (`goalMinutes`, anchor, workdays) | shows `old → new` + signed delta, second press commits |
| **↻ re-sum** | `monthlyMinutes` — **can lower it** | shows `old → new`, second press commits |
| **banked/mo Set** | `monthlyMinutes` | refuses an empty/negative/junk field; shows `old → new` |
| **Discard** | nothing | resets the dial to the banked values, `onPreview(null)`, **stays in the view** |

Snapshot + restore live in `SessionContext` (`captureStatUndo` inside
`bankGoal`/`reconcileMonthTotal`, `undoLastStatChange` to reverse), so any
caller is covered — not just this panel. Storage shape and the one-level-deep
rule: `src/utils/statUndo.js`.

**Why `statUndo` is not the call-log undo:** `dailyLog`/`historyTimeline` are
maps of every day ever worked and need a per-day snapshot; `catintassist_stats`
is one small object. Different shape on purpose.

### The bug that started this

```js
onClick={() => { const v = Number(monthEdit); if (Number.isFinite(v) && v >= 0) onSaveMonth(Math.round(v)); }}
```

`Number('') === 0`, and `0 >= 0` passes. Clearing the box to retype it and
pressing Set **zeroed the month**. `parseMinuteCorrection()` is the guard now;
its own tests pin the empty case.

## Keys

- ↑/↓/←/→ move the dial — but **only when nothing is being typed**. The handler
  is on the wrapper, so it checks `event.target` first. `step()` clears the
  custom monthly override, which is why this matters.
- Escape → `onCancel` (leaves the view) and calls `stopPropagation()`. `App.js`
  *also* listens for Escape to leave the goals view; without this one keypress
  fired both.

## The ARS rate is not a setting

`SessionContext` fetches USD→ARS on mount (default 1050). It was rendered as an
editable box, which was a trap three ways over: never persisted, clobbered by
the next fetch, and clearing it made every `$` in the app read `$0`. Now
read-only, with the fetch time and a manual ↻ (`refreshArsRate`).

## Reachable from

Settings → Goals (searchable, v4.161.0), the header 🎯, the condensed
`{n}h/wk` pill, the cat logo, Escape. `onOpenGoalsView` early-returns during a
call or zombie call (`App.js:306`) — four entry points in `DashboardHeader`
still render mid-call and do nothing.

## The wheel is a slider (v4.163.0)

One value, so it is a real `role="slider"`, not a pile of `<div onClick>`:

- `aria-valuemin/max/now` + `aria-valuetext` = `"40 hours per week · 370 minutes a
  day · 7400m a month"`. The row contents are not announced individually.
- **It takes focus when the panel opens**, so the arrow keys work on arrival.
  Before, `tabIndex={0}` existed on the wrapper but nothing focused it, so you
  had to Tab there blind.
- ↑↓←→ step one row, PageUp/PageDown four, Home/End the ends. The wrapper's
  keydown handler must therefore **skip** the event when the target is the wheel
  (`t !== wheelRef.current`) or the keys fire twice.
- Rows stay mouse-clickable; they are decorative to a screen reader because the
  slider already carries the value.

The pace box (`.dial-catchup`) and the ladder card are `aria-live="polite"`.

## Layout at 900×600 (v4.163.0)

The pane is ~520px and the content ~600px, so **Bank Goal used to be below the
fold**. `.dial-actions` is now `position: sticky; bottom: -1rem` with a gradient
that hides the content scrolling under it. Anything added to this panel must go
*above* that block or it will push the actions out of reach.

Classes now carry the layout: `.dial-wheel`, `.dial-field`, `.dial-ladder`,
`.dial-catchup`, `.dial-actions`, `.dial-note`, `.dial-undo`, `.dial-mini-btn`.
Only genuinely dynamic values stay inline (the wheel's row padding, which is
derived from `itemHeight`).

## Off-call only, and it says so

`onOpenGoalsView` early-returns during a call or zombie call
(`App.js:305`). Five entry points can be pressed mid-call — the header 🎯
(hidden there), the targets chip, the `m7` metric cell, the DAILY income card
and the 📅. They all shared that silence, so v4.163.0 puts the message in the
one handler they all call: a top-of-screen `.goals-blocked-notice`
(transcript-safe — the reading column is untouched), auto-dismissing in 4s.

## Still open

- `catchUp` is wrapped in `try/catch → null`, so a maths error would present as
  "no preview" with no message.
- `GoalEditor` (`HeaderWidgets.js`) is dead code; `bankedMonthOverride` is
  declared but never passed by any caller.
- The dial still reports `role="dialog"` although it is not modal (the calendar
  beside it is interactive). It has `aria-modal` unset, which is honest, but the
  role could arguably be `group`.
- `bankedMonthOverride`/`dailyMinutes` remain only partly used.

