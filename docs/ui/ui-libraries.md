# UI libraries worth mining (added v4.134.0)

Reference list + quick eval of what we'd actually pull, for THIS app:
plain CSS (no Tailwind), transcription-first, 900×600 min, token-cheap.

| Site | URL | Verdict |
|---|---|---|
| Beautiful UI | https://beautifului.dev | Inspiration only — scoreboard grid + chip styling ideas |
| BeUI | https://beui.dev | Inspiration only — dense-data table/card patterns |
| Rare UI | https://rareui.com | Inspiration only — unusual components, sparse value |
| Transitions.dev | https://transitions.dev | **Highest value** — micro-transition patterns for bubble mount/seal, panel slides |
| shadcn/ui | https://ui.shadcn.com | **Crib patterns, not code** — collapsible, tooltip, toast, dialog behavior specs; reimplement in plain CSS (no Tailwind dep) |

## Rules for pulling from these
- No new dependency unless it removes >2 hand-rolled components.
- Copy the *behavior spec* (timing, easing, states), restyle to our dark theme.
- Anything touching the transcript pane must respect StableTextMorph rules
  (no blank remounts, protected tokens never animate) — see
  [`docs/transcription-pane/README.md`](../transcription-pane/README.md) §12.

## Problem #1 it must solve: bubble overflow/overlap
Transcription bubbles occasionally overflow into the next bubble so neither
is readable. Root cause chain found (v4.134.0 fix shipped):
1. Live-bubble `minHeight` lock (`src/utils/liveBubbleHeight.js`) locked
   heights measured mid-animation.
2. `.transcript-bubble.is-live` animated `min-height` over 120ms, so every
   re-render measured an in-between height and fed the lock back into itself.
3. Result: bubble N held inflated height; the sticky-bottom scroll mounted
   bubble N+1 over the unreadable space.

Fix: lock growth requires text growth; height-shrink-while-text-grows is
ignored; `min-height` transition removed; scroll-area got bottom padding so
the last bubble can't clip. Regressions: `liveBubbleHeight.test.js`.

Next UI problems from these libraries should be evaluated against the
80/20 rule: transcript+translation ≥80% of viewport, scoreboard ≤20%.
