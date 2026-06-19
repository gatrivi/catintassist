# Handoff: UI Cleanup

## Problem
Expanded scoreboard and header chrome waste space and overlap. Work pane must stay stable during calls (v4.55).

## Stability checklist (do not regress)
- [ ] No inline status/diagnostic boxes in transcript bubbles
- [ ] Auto-scroll only on new bubble or last bubble finalize
- [ ] `MemoTranslatedBubble` stays memoized
- [ ] Fixed min-height on `.bubble-col-rail` / retranslate btn
- [ ] No `.is-flowed` animation jitter (border cue only)

## AGENTS.md inbox items (candidates)
| Issue | Location | Direction |
|-------|----------|-----------|
| Dead key button | Expanded scoreboard | Remove or hide behind tools |
| Auto mux / zap stream unused | DashboardHeader | Collapse or remove |
| Sound check overlaps call timer | Scoreboard expanded | Re-grid or hide when in call |
| Expand/collapse/save waste v-space | Scoreboard header | Inline row with other controls |
| Show tools only used for notes + background | Sidebars | Default hidden; call focus mode |

## CSS zones (`src/index.css`)
| Prefix | Area |
|--------|------|
| `.sb-*` | Soundboard studio |
| `.bubble-*` | Transcript rows |
| `.off-call-*` | Off-call 80/20 workspace |
| `.header-progress-*` | Progress bars |
| `.scoreboard-*` | Metric grid |

## Rule
Anything appearing/disappearing in the **work pane** needs CSS transition or reserved height — no dance dance revolution.

## Touch only
- `src/index.css` (targeted sections)
- `src/components/DashboardHeader.js` (chrome cleanup)
- `src/components/GameScoreboard.js` (density)

## Do not touch
- Translation engine chain
- Deepgram socket lifecycle unless task says so

## Acceptance
- 900×600 usable during active call
- No new console spam
- User can verify version bump

## Phase
Incremental cleanup PRs — one concern per ship.
