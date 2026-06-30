# Dashboard UI Audit (v4.74.5)

## Scope
This audit focuses on the off-call `DashboardHeader` chrome:
- Header container: `dashboard-header`
- Sticky controls row: `session-controls-sticky-row` (sticky “Connect/Stop/Hold”-chrome + left micro buttons + right utility icons)
- Version/debug indicator: `header-app-icon-btn` (tooltip on hover)
- Audio I/O status strip: `AudioRouteStatusBar` (buttons with standardized `id`s)

## Why this exists
The header area is the highest-friction part of the app when layout breaks. This doc captures:
1. The intended DOM structure.
2. The CSS selectors that affect width/cropping/click behavior.
3. The `id`s for interactive header elements (so “which button fixes it” can be debugged/persisted later).

---

## Version indicator (tooltip on hover)
### DOM / behavior
- Rendered by `DashboardHeader` inside the right-side control row.
- Element: `button#header-app-icon-btn`
- Tooltip: `title="Build: ${APP_VERSION_LABEL}"`
- Default intent: show build version without taking width or blocking clicks.

### CSS
- `button` uses the `btn-icon` / `tiny-btn` styling plus inline styling.
- Global:
  - `.btn-icon` gives light readable text/icon color and stable line height.

### Visibility toggle
- SettingsPanel → **Display** section:
  - Checkbox: “Show build version badge (debug)”
  - Backing key: `catint_show_version_badge_v1`
  - Update event: `catint_show_version_badge_changed`
- `App.js` listens for that event and passes either:
  - `versionLabel={APP_VERSION_LABEL}` or `versionLabel=""` into `DashboardHeader`.

---

## Header layout containers

### `dashboard-header` (header shell)
- Selector: `.dashboard-header`
- Current key properties:
  - `display: flex; flex-direction: column`
  - `gap: 0.25rem`
  - `padding: 0.25rem`
  - `max-height: min(42vh, 320px)`
  - `overflow-y: auto`
  - `overflow-x: visible` (prevents horizontal cropping of tiny buttons)

### Sticky controls: `session-controls-sticky-row`
- Selector: `.session-controls-sticky-row`
- Rendered by `SessionControlsSticky` (children are “poured” directly into the header row, no separate wrapper element needed for chrome).
- Current key properties:
  - `position: sticky; top: 0`
  - `z-index: 250`
  - `width: 100%`
  - `padding: 4px 6px`
  - `margin-left/right: 0` (no negative offsets; avoids “cornered” layout)
  - `background: rgba(12, 12, 18, 0.96)`
  - `border-bottom: 1px solid rgba(255,255,255,0.08)`
  - `overflow: visible`

---

## Buttons & typography normalization

### Shared button base styles
- `.btn-icon`
  - `display: flex; align-items/justify-content: center`
  - `color: rgba(226,232,240,0.95)`
  - `line-height: 1`
  - `transition: background 0.2s`
- `.btn-emoji`
  - `display: flex; align-items/justify-content: center`
  - `width: 30px; height: 30px`
  - `color: rgba(226,232,240,0.95)`
  - `line-height: 1`

### Purpose
Ensures header micro-buttons do not render black-on-dark backgrounds and are not vertically cropped.

---

## Audio I/O Status Strip (`AudioRouteStatusBar`)
### Rendering notes
`AudioRouteStatusBar` uses inline styles for layout, but button colors and font sizes were tuned for readability.

### Key interactive elements (standardized `id`s)
All buttons below are in `src/components/AudioRouteStatusBar.js`:
- `#audio-route-mic-settings-btn` (Microphone level / mic settings)
- `#audio-route-input-device-btn` (Input device / tab capture)
- `#audio-route-tab-share-btn` (Retry Tab share when cable failed)
- `#audio-route-reconnect-audio-btn` (Reconnect audio source when mode mismatch; error-highlighted)
- `#audio-route-output-btn` (Output / virtual mic route)
- `#audio-route-test-local-btn` (Test local speakers)
- `#audio-route-test-route-btn` (Test route via virtual output)
- `#audio-route-soundboard-btn` (Full greeting health check; shown off-call)
- `#audio-route-zap-btn` (⚡ Zap reconnect; shown when stale/critical + reconnect stream handler)

### Error highlighting contract
- When `connectionState === "error"`, the “fix path” buttons (Reconnect/Zap) switch to:
  - red border
  - red box-shadow
  - red-tinted text
This matches the “only red if transcription failing” intent.

---

## Session controls (important IDs)
These are rendered by `SessionControlsSticky` in `src/components/DashboardHeader.js`:
- `#header-mic-test-btn`
- `#header-lang-pair-btn`
- `#header-goal-btn`
- `#header-key-vault-btn`

When `connectionState === "error"`:
- mic/lang/goal buttons switch to red-tinted backgrounds/borders to show the likely “next click” path.

---

## Global tint variables (blue default)
Ambient glow is driven by CSS variables:
- `:root --glow-1`, `:root --glow-2`
- `body` uses `radial-gradient(... var(--glow-1) ...)` + `radial-gradient(... var(--glow-2) ...)`
- `data-state="call"` overrides glow variables to keep the app blue during normal operation.
- `connectionState === "error"` drives red accents for the “repair” buttons and the top mic bar (not global tint).

---

## What’s still missing (future hardening)
1. A real persistent “button health / which fixes it” store (DB/IDB backed) keyed by:
   - `connectionState` / diagnostics outcome
   - selected audio mode + STT pair
2. A formal CSS inventory for *every* button variant (some are inline-styled).
3. A screenshot regression harness (so “carpet bombed” layout never reappears unnoticed).

