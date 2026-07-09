# /wrapup

Sleepy-coding handoff. **No code unless fixing a broken check you just ran.**

## Steps
1. `git status` + short `git diff --stat`
2. List changed files (path → one line)
3. What was fixed / added (from → to, laconic)
4. What may break (STT, numbers, soundboard route, 80/20 layout, crash on start)
5. Manual test steps (3–7 checkboxes, 900×600 if UI)
6. Next safest task (one item from handoff/roadmap — smallest)

## Hard rules
- No commit/push unless user already asked in this turn
- Repo scripts only: `npm test`, `npm run build` (no `npm run lint`)
- <80 words + bullets

## Output template
```
## Changed
- path — why

## Fixed
- …

## May break
- …

## Manual
- [ ] …

## Next safest
…
```
