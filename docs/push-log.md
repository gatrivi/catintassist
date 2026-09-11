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
| 2026-09-09T21:21:05.975Z | b3b2d59 | chore untrack scratch |
| 2026-09-09T22:08:23.976Z | 2bad8e3 | v4.95.4 live counters perf - money+time roll at 1Hz, no odometer |
| 2026-09-09T23:54:48.979Z | fd69848 | v4.95.3 explain+fix soundboard UX |
| 2026-09-10T15:02:41.220Z | a85ac42 | v4.96.0 catch-up clarity: chip deficit number + expanded catch-up plan strip + dial-goal targets |
| 2026-09-10T16:05:48.812Z | e258a6f | v4.96.1 habit toasts never stick — 15s cap, click-dismiss, call-start clear |
| 2026-09-10T16:34:24.587Z | dc2ad20 | v4.96.2 chip narrow-window fit: no more counter overlap on STT/EN-ES buttons |
| 2026-09-10T17:28:51.544Z | 5f8546e | v4.96.3 in-call header card — numbers grid replaces empty game face |
| 2026-09-10T17:41:13.091Z | 6cedbec | docs: field incident cable-silent checklist + push-log rows v4.96.1-v4.96.3 |
| 2026-09-10T17:49:47.802Z | 5401767 | v4.96.4 preflight failure shows script inline |
| 2026-09-10T18:28:14.648Z | 133f636 | v4.96.5 heatmap hand-edit syncs scoreboard + deficit |
| 2026-09-10T20:24:29.025Z | 95d2e6a | v4.97.0: mic verify panel - dropdowns, live probe, loopback, edge-default mismatch guard |
| 2026-09-10T22:06:25.160Z | 56c6a66 | v4.98.0 call autopilot — phrase auto start/end, 10s cancellable, editable phrases, log-only tone listener |
| 2026-09-10T23:39:58.156Z | f7f3455 | v4.99.0 durable time ledger — midnight rollover, 60s banking, firebase timetrack mirror; multi-user access TODO |
| 2026-09-11T12:05:41.659Z | 61a8632 | v4.99.1 hotfix — MicVerifyPanel null-verdict crash on first render |
| 2026-09-11T12:33:04.939Z | 7f613f5 | v4.99.2 honest scoreboard — single-day live counters, no re-attach double-bank, no-STT calls bank wall-clock, month incl live call, one-line header strip |
