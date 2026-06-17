## Refactor Checklist for Interview-Ready Maintenance (v4.48.9)

### Non-negotiables (behavior + safety)
- Keep translation and pinned caption behavior intact. Refactors must be behavior-preserving.
- Avoid changing call lifecycle semantics (attach/connect/start/stop/break/endDay + HIPAA grace).
- When splitting mixed components, extract logic into hooks/helpers first; keep render changes minimal.

### Goal: “I can find the feature in <10 seconds”
Use file/name-based navigation:
- When a dev wants “X”, they should be able to jump to the domain file whose name suggests X.
- If a file is mixed, split it along domain boundaries (session vs transcript UI vs translation policy vs soundboard).

### Logic vs presentational separation (standard)
For each large mixed-responsibility file:
1. Identify “effects + state machine” logic (timers, socket lifecycle, storage, audio routing, async requests).
2. Identify “pure render” logic (layout, UI structure, classes/styles, static subcomponents).
3. Move step (1) into:
   - a hook (e.g. `useFoo()`), or
   - a small pure helper module (for deterministic transformations).
4. Keep step (2) as presentational components with props that are already computed.

### Prop-depth minimization (practical rule)
- Prefer passing precomputed/flattened props from hooks into presentational components.
- Avoid “prop drilling” where UI needs to traverse many levels to reach a single value.
- If a UI component needs many values from context, consider moving those context reads into the nearest container/hook.

### Extract pure helpers whenever possible
Extract deterministic logic into `utils/` or small modules, such as:
- transcript bubble heuristics (sentence peel, comma chunk boundaries)
- time math/formatting
- “compute derived metrics” functions
- data shaping (turn transcript structures into render-ready arrays)

### Suggested folder naming convention (optional, no renames required)
When adding new files (or doing future refactors), follow:
- `features/<domain>/<thing>.js`
  - `features/call-session/*` (timers + call transitions)
  - `features/transcription/*` (bubble formatting/render helpers)
  - `features/translation-tts/*` (useTranslate/useTTS orchestration + policy)
  - `features/scoreboard/*` (metric selectors + tile renderer)
  - `features/soundboard/*` (greetings studio + recording flows)

This is a convention to make “where to look” obvious.

### Safe refactor order (low risk)
1. Extract pure helpers from within the big file.
2. Move that extracted helper behind a hook (logic only).
3. Replace the big file’s internal logic with hook calls.
4. Only then split presentational subcomponents (small render files).
5. Keep wiring and props stable, then run the app tests/build.

