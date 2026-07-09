# /patch

Apply the **smallest safe patch**. Preserve architecture. Tests only if nearby.

## Preconditions
- Prefer a prior `/diagnose` plan. If none: diagnose in ≤5 sentences, then patch.
- If architecture is unclear → stop and ask (do not invent layers)

## Steps
1. Touch only the files in the plan (or the single shared helper)
2. Smallest diff that fixes root cause — no drive-by cleanup
3. Add/update a test **only if** a sibling `*.test.js` already exists nearby, or the change is non-trivial pure util logic
4. Run `npm test` (scoped pattern if obvious; else full)
5. If feature-facing: bump version in `src/App.js` and mention it in the reply
6. Laconic report: what changed · from→to · test result · version

## Hard rules
- No new deps, no new abstractions, no rewrites
- Never block audio/STT hot path (`src/hooks/useDeepgram.js`, soundboard play path)
- Numbers/phones: do not weaken `sensitiveDataProtector`
- Do not commit/push unless user asks
- Ponytail: deletion > addition; one shared guard > N call sites

## Output template
```
## Patch
- path: from → to (one line)

## Tests
- …

## Version
vX.Y.Z (if bumped)

Say **commit** / **/ship** if ready.
```
