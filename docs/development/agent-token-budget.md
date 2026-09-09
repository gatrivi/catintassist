# Agent Token Budget Playbook (tldr)

Goal: ship features without draining core token bags. Read once, apply always.

## Rules

1. **Batch features per session.** One session = one verified feature set (impl + tests + build + single push). Never one session per tiny commit — context reload of AGENTS.md/docs is the hidden cost.
2. **Broad search → Explore agent.** "Where does X happen?" = delegate. One agent sweep < agent reading 10 files.
3. **Known file/symbol → direct Read/Grep.** Don't delegate single lookups (version bump, one function).
4. **Visual QA → judge agent, once, at the end.** Render pages to PNG, one judge pass, act on verdicts. Never pre-screen images yourself AND judge (doubles cost).
5. **Browser/computer-use only for GUI verification** that can't be checked by tests/build. Each screenshot costs tokens.
6. **Keep md files tldr.** AGENTS.md + big docs are paid on every message. Trim, don't append walls.
7. **Tests before push, one push per feature set** via `node scripts/safe-push.js "label"` (Vercel free-tier guard).
8. **Delegate independent work in parallel** (multiple agents in one message) instead of sequential agent calls.
9. **Don't re-verify finished work.** Edit/Write already error on failure; no re-reads to "check".
10. **Summaries tiered** (AGENTS.md): most replies <40 words. Long plans live in files, not chat.

## Cost ranking (cheapest → priciest)
direct Read of one known file → Grep → Explore agent (fan-out search) → general-purpose agent (multi-step build) → browser screenshot sessions → judge render passes.

Pick the cheapest tool that answers the question.
