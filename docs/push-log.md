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
| 2026-09-09T17:19:43.581Z | 62d049d | v4.94.1 cpu freeze fix |
| 2026-09-09T17:23:58.114Z | 04b9065 | docs: handoff 13 cpu freeze |
| 2026-09-09T17:53:21.103Z | c3056a1 | v4.95.0 soundboard live-readiness |
| 2026-09-09T17:54:01.042Z | 72b953c | docs: v4.95.0 changelog line |
| 2026-09-09T19:42:21.285Z | 705ce4c | v4.95.1 teleprompter + raw-mic recording |
| 2026-09-09T19:46:54.575Z | 5048724 | v4.95.2 calmer studio UI |
| 2026-09-09T21:19:43.231Z | f6de1aa | v4.95.3 inspector off by default |
