# Dashboard header — evaluation (v4.165.0)

`src/components/DashboardHeader.js` = **3,424 lines**, **216 inline style objects**.
This is the most-looked-at chrome in the app, so it accumulated the most debt.

> **Read this first:** `.session-controls-sticky-row` is **one of three stacked
> rows** inside `<header>`, not the header. The header is buttons + I/O strip +
> goal meter (in call) or sticky row + I/O strip + scoreboard (off call).

## Glossary (these names are not self-explanatory)

| name | what it is |
|---|---|
| **sticky row** | the top row of buttons: cat, CONNECT/STOP, timers, BREAK, 🎯, HOLD, ZAP, 📊, ⌃, EN\|ES, 🌙, ⚙ |
| **I/O strip** | the second row, under the buttons. Shows the audio source (TAB / VB), the route proof, and audio-test buttons. Compact form is what the header renders |
| **goal meter** | a 19px horizontal bar that only appears in the compact call header |
| **call-compact** | in-call, collapsed: just the three rows, ~90px |
| **call-expanded** | in-call, expanded: sticky row + I/O strip + the 12-cell metric grid, ~228px |
| **headerMinimal** | a flag that hides the whole scoreboard body, leaving only the sticky row. On for `soundboard` and `goals` |
| **meter-only** | the 📊 HUD mode: a bigger goal meter, the center column CSS-hidden |

## The 80% rule is a GUIDELINE, not a gate

The operator's standing rule is "80% of viewport must be transcription". **Check
it; do not enforce it by capping.** Two reasons, both learned the hard way:

1. Capping does not create space — it hides controls. The 12-cell metric grid
   alone is 134–144px, so any cap that satisfies 80% has to hide the grid.
2. The real problem is **subtraction**: roughly half the header's components are
   unused and half of the rest are empty. Space comes back by deleting those,
   not by shrinking the container.

**Ask before treating this as a hard rule.**

## Vertical budget at 900×600

Assumptions: `1rem = 16px` (no `html{font-size}` rule exists); `* { box-sizing:
border-box }`; `--btn-h`/`--btn-icon` = 26px, forced to **23px at ≤1100px**
(`index.css:4205-4208`); `.glass-panel` adds 1px border top and bottom.

| state | header | cap | transcription | 80%? |
|---|---|---|---|---|
| off-call, minimal (soundboard/goals) | 76px | none | 87.3% | ok |
| off-call, scoreboard collapsed (default) | 83px | 132px (`22vh`) | 86.2% | ok |
| off-call, metrics expanded | 278 → **228** | 228 (inline) | 62% | over |
| off-call, greeting-editor | 83 + card → **88, clipped** | 88, `overflow:hidden` | — | broken |
| in-call, call-compact | 90px | none | 85% | ok |
| in-call, meter-only | 95px | none | 84.2% | ok |
| in-call, call-expanded | 240 → **228** | 228 (`38vh`) | 62% | over |

The code comment at `DashboardHeader.js:235` says "sticky row only (~40px)". It
is **~90px**: the 32px sticky row is not the whole header.

## Broken or invisible

| # | finding | where |
|---|---|---|
| 1 | `headerMinimal` omits `greeting-editor`, so the full scoreboard + progress stack render above the Greeting Editor — and at ≤900px the header is capped at **88px with `overflow:hidden`**, so that content is unreachable, not scrollable | `DashboardHeader.js:900`, `index.css:4232` |
| 2 | `#daily-targets-chip` is rendered **twice** in meter-only mode: once inside `.session-controls-center` (CSS-hidden at `index.css:320`) and once visible in the meter row. Duplicate DOM id + two `ResizeObserver`s | `DashboardHeader.js:635`, `:3385` |
| 3 | `.metric-pill` sets `cursor: copy` but has **no click handler** — 5 pills | `index.css:5279`; pills at `:2447, 2450, 2493, 2497, 2511` |
| 4 | The off-call condensed toolbar is skipped when `offCallScoreboardView`, so **Min/Std/Full, Notes, Tools, Help, Edit-grid, Call detection and Call Focus have no entry point** in the default off-call view | `:2428` |
| 5 | The 🎯 chip is visible mid-call but can only raise a toast | `:635` → `App.js` off-call guard |
| 6 | The header always passes `compact` to the I/O strip, and `.audio-route-status-full` is `display:none` in compact — so **Test local, Test VB out, mic/sink/cable selects, mic meter, tab-share proof and reconnect are unreachable from the header**. The capability lives in Settings → Audio | `DashboardHeader.js:855`, `index.css:4402` |
| 7 | `maxHeight` is set **inline from a localStorage value**, silently overriding every CSS cap (`:1145, 1154, 1163, 372, 4226`). The vertical budget is not inspectable in CSS | `DashboardHeader.js:3269` |

## Dead vs. merely-dead-looking — READ BEFORE DELETING

**The rich tooltips were retired on purpose, and the native ones still work.**

`ElementHint.js:12-14`: *"v4.112.2: passive tooltips retired (HudInspector ⌖
picker covers element select). Kept as a pass-through so existing imports mount
cleanly; renders children only, no portal, no hover listeners."*

`ElementHintProvider` is exported and **never mounted**. So `useElementHint()`
returns `{ show: noop, hide: noop }` and everything feeding it does nothing:

| dead (safe to cut) | alive (KEEP) |
|---|---|
| `showProgressBarTooltip` `:1512-1529` | `title={monthlyTooltip}` `HeaderMetricsStrip.js:87` |
| `showMetricTooltip` `:1488-1505` | `title={stepTooltip}` `:94`, `dailyTooltip` |
| `onBarHover` / `onBarLeave` / `hover({...})` chain | every `title=` on metric cells, pills, timers |
| `metricTooltipData` `:1413-1486` (verify no `title` consumes it first) | the tooltip **copy** those titles display |
| `ElementHintTarget` wrappers (pass-through) | `HudInspector` ⌖, which replaced them |

**The progress bars work.** What the operator sees on hover is the *native*
`title`, not the rich panel. Cutting `title` props would break a working
feature; cutting only the `show/hide` wiring removes true dead weight.

### Provably dead branches

`disableZap={false}` `:3312` (kills `:564-566`) · `connectRequireDoubleTapIndicator
= false` `:1862` (kills `onArmDoubleTap` + `pendingDoubleTapTitle`) ·
`apiKeyMissingNoVault` `:236`, `settingsOpen` `:258`, `vaultStatus` `:259`
(destructured, unused) · `renderOffCallCollapsedBody()` returns `null` `:2054` ·
`visibleCards.moneyMonth / moneyToday / avail / goal` (declared in all three
presets, never read).

### Dead CSS (no matching JSX)

`.session-controls-sticky` · `.off-call-status-column` · `.status-bar-timers` +
`--compact` · `#header-stt-latency-btn` · `.call-micro-bar` · `.scoreboard-area`
· `.char-slot` · `.header-goal-btn` (no such class; the button is id-only).

**`.session-controls-sticky-row` is defined twice** — `index.css:658-666` and
`:4410-4429`. The later wins, so `overflow-x:auto` and the ≤900px padding rule at
`:4272` are **dead**. Below ~1000px the off-call gap row is **clipped, not
scrollable** (`overflow:hidden` at `:675-680`). Delete the first definition and
the behaviour does not change.

## Structural debt (deferred — needs a decision)

- **Three different numbers for "today's goal"**: `dailyGoal` `:1334`,
  `computeCatchUp().requiredToday` `DailyTargetsChip.js:82`,
  `computeGoalDay().dailyMin` `:12`.
- **Two truths for the month total**: `monthlyBanked` `:1698` vs raw
  `stats.monthlyMinutes` — and an effect **writes back to session state**
  `:1700-1705` (render → context → render).
- **Duplicated controls**, 2–3 mounts each: Break, Notes, Tools, Help,
  Edit-grid, Collapse, ZAP, mic/sink selects, score-view switch, workspace
  switch. **Six** entry points to the goal wheel.
- **1 Hz full-header re-render, forever**: the `silenceCount` interval
  `:1111-1116` is rebuilt on every `lastActivityTime` change, defeating the
  `React.memo` at `:230`. `Date.now()` is called *inside render* at `:207, 586,
  1176, 1580, 1773, 3237` → visible tick/aliasing. Three independent 1Hz–12s
  timers live in this subtree.
- `isCollapsed` is local and **not persisted**, while the scoreboard height it
  coexists with is.
- ~250 inline style objects: the *chrome* is ~90% CSS, but the scoreboard, income
  dashboard, progress bars and targets chip are ~95% inline, so none of them can
  be themed or re-budgeted from CSS.

## Test coverage

`DashboardHeader.test.js` = 5 tests, all about the targets chip not being
duplicated and being in the right row. **No test exercises a single sticky-row
control.** No zombie-call test, no `callFocusMode` / `isCollapsed` /
`scoreboardPreset` test, no DOM-order test, and nothing asserting the budget.

## v4.165.0 — Phase 1 (shipped): real bugs, no behaviour change

| fix | before | after |
|---|---|---|
| **Greeting Editor header** | `headerMinimal` covered only `soundboard` + `goals`, so the full scoreboard + progress stack rendered above the Greeting Editor — and at ≤900px that is 88px of `overflow:hidden`, i.e. unreachable | `greeting-editor` added to `headerMinimal`; all three workspace views hide the body |
| **Duplicate chip id** | meter-only mode mounted `#daily-targets-chip` twice (center column, CSS-hidden, + the meter row) with two `ResizeObserver`s | the center-column copy is not mounted when `meterOnly` |
| **`cursor: copy` with no handler** | `.metric-pill` promised a copy on 4 pills; nothing listened | `CopyPill` — real clipboard write, ✓ flash, `role="button"` + `tabIndex` + Enter/Space. Empty placeholders get `cursor: default` instead of lying |
| **Grab-bar height** | `maxHeight` written **inline** from localStorage, silently beating every CSS cap | `--scoreboard-max-vh` custom property, consumed at `index.css:1163`. Behaviour identical: the dead `260px` term in that rule was never in effect, and restoring it would have quietly capped the grab bar's range — a product decision, not a bug fix |
| **`.goals-blocked-notice`** (my own v4.163.0 regression) | `top: 40px` is *inside* the ~90px call-compact header, and its `z-index: 99992` beats the header's `100` — so it painted over the sticky row mid-call | anchored `bottom: 44px`, clear of the on-call soundboard strip, where the other transient notices already live |

### Still open after Phase 1

**The pills, the condensed toolbar and the income dashboard are now reachable
only in the in-call expanded header.** Finding #4 is not an oversight in the copy
fix — it is the underlying problem, and it is deferred by choice:

- `renderWorkspaceBody` is gated by `!headerMinimal`, so the three workspace
  views render no body at all.
- The condensed toolbar is gated by `!offCallScoreboardView`, so the default
  off-call view has no toolbar.
- The income dashboard needs Settings → `expanded_income_cards`.

So off-call there is currently **one way** to reach Min/Std/Full, Notes, Tools,
Help, Edit-grid, Call detection, Call Focus — or none. Restoring that is the
next decision, not a silent side effect of this pass.

