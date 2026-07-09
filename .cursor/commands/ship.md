# /ship

Pre-commit gate for CatIntAssist. **Do not commit or push unless the user explicitly asks.**

## Steps
1. `git status` + `git diff` (staged + unstaged) + recent `git log -5 --oneline`
2. Summarize changed files (path → one-line why)
3. Run checks if available:
   - `npm test` (always when JS/utils/hooks/components touched)
   - `npm run build` before any push recommendation
   - Lint: only if a lint script exists (this repo has none standalone — rely on CRA/eslint via test/build)
4. Identify risks (STT hot path, numbers/phones, soundboard audio route, viewport 80/20, crash on start)
5. Draft a commit message (why > what, 1–2 sentences). Match recent log style.
6. Stop. Show: summary · risks · proposed message · “say commit/push to proceed”

## Hard rules
- Never commit/push without explicit user ask
- Never `--force` / amend unless user asks + amend rules met
- Version bump in `src/App.js` must be present if this is a feature ship — flag if missing
- Laconic output (<80 words body + bullets)

## Output template
```
## Diff
- path — why

## Checks
- test: pass|fail|skipped
- build: pass|fail|skipped

## Risks
- …

## Commit message
<draft>

Ready: say **commit** (and **push** if wanted).
```
