---
name: ui-sticky-cleanup
overview: "Make the narrow header cleanup patch: neutralize stale `.session-controls-sticky` CSS, move the flex layout for `session-controls-sticky-row` into CSS, and keep the version tooltip behavior unchanged (visible-by-default). Then run tests and a production build."
todos:
  - id: sticky-css-neutralize
    content: "Edit `src/index.css`: replace `.session-controls-sticky { ... }` with `.session-controls-sticky { display: contents; }`. Remove negative-margin logic/comments."
    status: pending
  - id: sticky-row-flex-css
    content: "Edit `src/index.css`: add `display:flex; align-items:center; justify-content:space-between; gap:0.5rem; width:100%` to `.session-controls-sticky-row`."
    status: pending
  - id: sticky-row-jsx-simplify
    content: "Edit `src/components/DashboardHeader.js`: change the outer `session-controls-sticky-row` div to `<div className=\"session-controls-sticky-row\">` (remove inline style prop)."
    status: pending
  - id: verify-tests-build
    content: "After edits: run `npm test` and `npm run build` to confirm no regressions."
    status: pending
isProject: false
---

## Goal
Apply a narrow, targeted cleanup patch for v4.74.5 UI layout:
- Remove/neutralize the stale `.session-controls-sticky` CSS block (negative margins + old padding math).
- Ensure `.session-controls-sticky-row` is the actual sticky chrome and owns the flex layout.
- Do not touch Deepgram/audio/STT/routing logic.
- Run `npm test` and `npm run build` after the patch.

## Patch details

### 1) `src/index.css`: neutralize stale `.session-controls-sticky`
Current CSS contains negative margins and comments; replace it exactly with:
- `.session-controls-sticky { display: contents; }`

This keeps children participating in the parent layout without that container affecting width/overflow.

Files/sections:
- `src/index.css` at the `.session-controls-sticky { ... }` block.

### 2) `src/components/DashboardHeader.js`: remove inline flex from `session-controls-sticky-row`
Change the outer wrapper from:
- `<div className="session-controls-sticky-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>`
To:
- `<div className="session-controls-sticky-row">`

### 2b) `src/index.css`: add flex layout to `.session-controls-sticky-row`
Add the missing layout rules currently inlined in JSX into the `.session-controls-sticky-row` CSS rule:
- `display: flex;`
- `align-items: center;`
- `justify-content: space-between;`
- `gap: 0.5rem;`
- `width: 100%;`

Keep the existing sticky “chrome” (position/background/border/etc.) that’s already in `.session-controls-sticky-row`.

### 3) Version badge default (visible by default)
Based on your response (“tooltip on hover of the app icon”), we will keep the version indicator behavior enabled by default.
Therefore:
- Do NOT change the localStorage logic in `src/App.js` and `src/components/SettingsPanel.js`.

No edits in step3 (keep current `localStorage.getItem('catint_show_version_badge_v1') !== '0'`).

### 4) Guardrails
- No changes to Deepgram/audio capture, STT, virtual cable, or routing logic.
- Only edit the CSS/JSX mentioned above.

## Verification
1. Run `npm test`
2. Run `npm run build`

Expected result:
- Sticky chrome stays correct width.
- Removing `.session-controls-sticky` container effects prevents corner clipping.
- Button row layout becomes consistent because flex layout is centralized in `.session-controls-sticky-row` CSS.
