# ElementHint — Rich UI Tooltips (v4.75.5)

**Code:** `src/components/ElementHint.js` · mounted in `src/App.js` as `ElementHintProvider`

## What it is
Not browser `title=`. Not scoreboard `MetricTooltip`. **ElementHint** = hover popover with:
- Human-readable element name
- Short description
- **Copy** button → copies CSS selector (`#header-mic-test-btn` or `[data-guide="mic-test"]`)

## How to add on a control
```jsx
import { ElementHint } from './ElementHint';

<ElementHint
  name="Mic test"
  description="Plays a tone on your selected output device."
  elementId="header-mic-test-btn"
  guideKey="mic-test"
>
  <button id="header-mic-test-btn" data-guide="mic-test">…</button>
</ElementHint>
```

Selector priority: `elementId` → `guideKey` → `fallback`.

## Where wired (v4.75.5+)
- `DashboardHeader.js` — session controls, connect, settings
- `HeaderMetricsStrip.js` — condensed toolbar + 12 metric cells `#metric-m1`…`m12`
- `AudioRouteStatusBar.js` — I/O strip (`#audio-route-stt-in-badge`, `#audio-route-stt-summary`, soundboard, more, test buttons)
- `ConnectInterpretButton.js`, `SettingsButton.js`, `WorkspaceViewSwitcher.js`

## Other tooltip systems (don't mix up)
| System | Where | Purpose |
|--------|-------|---------|
| **ElementHint** | Header / chrome | Name + copy selector |
| **MetricTooltip** | `DashboardHeader` grid hover | Metric formula text |
| **ScoreboardTooltip** | `GameScoreboard` emoji rows | Game-view metric cues |
| `title=` | Legacy fallback | Browser native only |

## Tests
`src/components/ElementHint.test.js`
