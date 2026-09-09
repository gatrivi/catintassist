# Push log — Vercel FREE tier budget

> **Rule (AGENTS.md → PUSH BUDGET):** every push to `master` = a Vercel deploy on the free tier.
> **MAX 4 pushes per rolling 60 minutes** — over that, ask the user first.
> Use `node scripts/safe-push.js "label"` — it enforces the budget and appends the row below.
> Timestamps are UTC.

| pushed_at (UTC) | commit | message |
| --- | --- | --- |
| 2026-09-08T18:16:26Z | d8e3e37 | v4.89.1: hold auto-resume - click outside overlay or any speech lifts hold |
| 2026-09-08T18:25:59Z | 0587e63 | v4.89.2: HUD inspector ON by default - hover anything, click to copy |
| 2026-09-08T18:56:39Z | c28d87d | v4.90.0+4.91.0: auto break + smart USD tooltips on daily-targets chip |
| 2026-09-08T19:42:51Z | f6a3206 | v4.92.0: always-on ear - warm sockets + local VAD after STOP, speech auto-starts the call |
| 2026-09-08T19:46:13.080Z | e8938e1 | push budget: max 4/hour + log + guard script |
