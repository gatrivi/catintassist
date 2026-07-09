# /overnight

Unattended batch work in **small commits/checkpoints**. Leave a report. Stop on hard brakes.

## Mode
- Work the user’s stated goal (or open handoff item) in tiny slices
- Checkpoint often: after each green slice, summarize; commit **only if** user already authorized overnight commits in this thread — otherwise write a checkpoint note and continue editing
- Prefer `/diagnose` → `/patch` rhythm per slice
- Laconic progress; user may be asleep / on call

## Hard stop (halt immediately, write report)
1. Tests fail **twice** on the same slice (after one fix attempt)
2. Auth / secrets / interactive login needed
3. Architecture unclear (would need new layers, unclear ownership, or cross-cutting rewrite)
4. Would touch STT/audio hot path without a clear minimal fix
5. Build crash or app won’t start

## Per-slice loop
1. Pick one tiny goal
2. Implement smallest patch
3. `npm test` (scoped if possible)
4. If fail → one fix attempt → retest; second fail → **STOP**
5. Checkpoint note (files, intent, result)
6. Next slice or stop when goal done / timebox exhausted

## Report (always leave at end)
Write `docs/handoff/overnight-report.md` (overwrite or append dated section):

```
# Overnight report — YYYY-MM-DD

## Done
- …

## Not done
- …

## Checkpoints
- slice: files · test pass/fail · notes

## Stopped because
- none | tests×2 | auth | architecture | other: …

## Risks / follow-ups
- …

## Suggested next command
/ship or /diagnose …
```

## Hard rules
- No force push, no git config, no secrets in commits
- No push unless user explicitly allowed overnight push
- Version bump once per shipped feature slice that changes UX
- Keep diffs small; do not “while I’m here” refactor
