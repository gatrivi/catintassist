# Session status 2026-09-08 (v4.87.1, big session)

64 suites green · build clean · dev http://localhost:3001 (3000 taken by rosario-cards-v1).

## Roles
- **Big session (this one):** audio routing, soundboard, TTT wiring, handbook seed.
- **Little session:** call-log paste hardening (space-separated rows, max-seed, 09/08 59m dev seed). Don't stomp its files.

## Shipped today (big, uncommitted)
- VB attach: saved CABLE ID validated vs live enumeration; prompt-free stale retry (`inputSource.js`).
- VB-out picker: label memory (`audioDeviceLabels.js`), explicit-pick guard, strict Voicemeeter-Standard sink, friendly blank-label slots.
- Handbook: 14 verbatim scripts preloaded + one-time text reseed (audio untouched) — `soundboardMetaService.js`, Studio ACTIONS.
- Release-notes 4.87.1 entry (bump left it missing).
- TTT verified: `:59200` UP (PID 21536), EN↔ES byte-clean, CORS for `:3001` added in catts `api/main.py` + API restarted.

## Open (not done)
- `scripts/lift-local.ps1` + `npm run local` (59200 via catts lifter, 59210 gateway skip — no keys, 3001 app). CORS half is live.
- VB zero-prompt cleanup: remove `getUserMediaFn` fallback in `resolveVirtualCableInputDeviceId` (approved, unexecuted).
- User-side: Voicemeeter Strip[2]→B1 ON + caller-side greeting verify; QA handbook (later).
- catts side (user manages): duplicate uvicorn 21904 is dead weight, not listening.

## Env / contracts
- Dev log: `.tmp/dev-3001.log`. TTT: POST `127.0.0.1:59200/stt/translate` `{text,from_lang,to_lang}`.
- Tree is dirty (27 files, uncommitted, two sessions). Coordinate before staging anything.
