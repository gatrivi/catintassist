# Handoff: Scoreboard + Progress Bars

## Problem
Expanded scoreboard is cluttered (overlapping controls, dead buttons). User wants polish, percentages on metrics, optional rearrangeable grid.

## 20/80 rule
Scoreboard ~20% height. Never steal vertical space from interpret pane during calls.

## Key files
| File | Role |
|------|------|
| `GameScoreboard.js` | Metric tiles, emoji rows, condensed grid |
| `DashboardHeader.js` | Hosts scoreboard portal, `header-progress-stack` bars |
| `SessionContext.js` | Stats source — **read** for keys, avoid UI changes here unless metric logic broken |

## Stats keys (`catintassist_stats` in localStorage)
- `dailyMinutes`, `dailyBreakMinutes`, `dailyAvailMinutes`
- `monthlyMinutes`, `goalMinutes`
- `callsToday`, `streak`, `dayStartTime`, `lastDate`

## Progress bars (`DashboardHeader.js` ~L1808)
- **Monthly bar:** `stats.monthlyMinutes` / `stats.goalMinutes`, milestones at 5500/11000/16500
- **Daily bar:** (below monthly in same stack) — uses `dailyGoal`, `dailyMinutes`, timeline 9am–18hs
- Pending/unbanked minutes shown in orange overlay during active call

## Known mess (from AGENTS.md inbox)
- Sound check / bag / min buttons overlap call timer
- Expand/collapse/save buttons waste vertical space
- Auto mux, zap stream rarely used — candidate for hide/collapse
- User wants toggleable labels + outlines on scoreboard elements
- Saved layout key (recommended): `catint_scoreboard_layout_v1` via `react-grid-layout` (already in deps)

## Touch only
- `src/components/GameScoreboard.js`
- `src/components/DashboardHeader.js` (scoreboard/progress sections only)
- `src/index.css` (`.scoreboard-*`, `.header-progress-*`)

## Do not touch
- `TranscriptionBoard.js`
- Off-call 80/20 shell in `OffCallWorkspace.js` proportions

## Acceptance
- Readable at **900×600**
- If user asks for percentages, add to **all** listed metrics — not just one example
- Rearranged layout persists in localStorage
- No layout jitter in interpret pane

## Phase
1. UI cleanup / overlap fixes
2. Percentages + toggleable labels
3. Grid rearrange with saved layout
