# Scoreboard UX audit notes (v4.86.4)

Running notes so decisions can be reverted cheaply. Audit status: ~60% done.

## Shipped this pass (v4.86.4)
1. **Dead Metrics toggle hidden** — in full HUD mode (expanded income cards, non-portal, collapsed=false) the toggle did nothing visible; now hidden via `showExpandToggle`. Revert: pass `showExpandToggle` always true in `DashboardHeader.renderHeaderMetricsStrip`.
2. **Summary de-dupe** — when the expanded income HUD shows (`detailShown`), the strip summary drops `% mo · AR$` (duplicated in HUD cards). `Xm/goal` + 📞/📡 timers always stay. Revert: remove `detailShown` branch in `HeaderMetricsStrip` summary.

## Deferred (deliberately not done)
3. **Toolbar gate consolidation** — several `!offCallScoreboardView` gates hide toolbar buttons in portal mode (sticky header owns controls there). Intentional, not dead code. Blind removal risks "button vanished" bugs. If consolidated: single `controls-variant` prop (`portal | header | call`) passed down instead of scattered checks. Estimate: 2-3h, needs visual QA in all 3 modes.
4. **Remaining ~40% audit targets**: expanded income cards, emoji rows, progress stack + heatmap, goal wheel, idle tips, minimal/full presets E2E, soundboard workspace header.

## Revert instructions
- This pass: `git revert` the v4.86.4 commit — changes are 2 props + 2 conditionals, no data/format changes.
