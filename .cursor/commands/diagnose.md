# /diagnose

**Do not code yet.** Investigate the bug; produce a minimal fix plan only.

## Steps
1. Restate the symptom in one line (user words → observable failure)
2. Trace the real flow end-to-end (grep callers; read shared helpers once)
3. Name root cause vs symptom
4. List 1–3 candidate fixes; pick the **smallest** that fixes the shared function
5. Touch-only file list (prefer handoff scopes in `docs/cursor-agent/README.md`)
6. Risks: STT/audio path, number protection, layout thrash, false “fixed”
7. Stop. Wait for user to say `/patch` or “fix it”

## Hard rules
- No edits, no commits, no speculative refactors
- Prefer one guard in the shared function over N call-site patches
- Laconic: <80 words + short plan bullets
- Mention version only if relevant to repro

## Output template
```
## Symptom
…

## Root cause
…

## Plan (minimal)
1. …
2. …

## Touch only
- path

## Verify
- [ ] repro gone
- [ ] nearby test / manual check

## Risks
- …

Say **/patch** to apply.
```
