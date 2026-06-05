# Soundboard Roadmap Checklist

Status enum: `NOT_STARTED` · `PARTIAL` · `DONE` · `BROKEN`

Updated: v4.45.0 · See `00_PORTFOLIO.md` for interview priorities.

## Pass A — Safety & verification (current focus)

| Item | Status | Notes |
|------|--------|-------|
| `WORKSPACE_STUDIO` — Off-call scoreboard ↔ soundboard studio switch | `DONE` | v4.36–v4.37, art-deco switcher on grid + dock |
| `FIRST_VISIT_ONBOARDING` — Default scoreboard + subtle studio hint | `DONE` | v4.37, non-blocking glare until first click |
| `HEALTH_BAR` — Deepgram legibility score per clip | `DONE` | PEACHES → UNACCEPTABLE tiers |
| `TEST_MODE` — Local-only playback toggle | `DONE` | 🧪 blocks virtual mic route |
| `ANTI_SCREAM_RAMP` — 50ms volume ramp on play | `DONE` | |
| `PLAY_GATE` — Block virtual mic for untested / unacceptable clips | `DONE` | v4.38, play mode only; local preview still works |
| `CALL_PATH_TEST` — Explicit “hear what patient hears” button | `DONE` | v4.38, Setup → 📡 Call Test (sink only) |
| `LOCAL_PREVIEW_ISOLATION` — Preview does not hit default sink | `DONE` | v4.38, local element only |
| `CLIP_WAVEFORM` — Static waveform on saved clips | `DONE` | v4.39, Setup rows + play progress tint |
| `CALL_PATH_AUTO_VERIFY` — Auto pass/fail after call test | `NOT_STARTED` | Next baby step |

## Pass B — Daily use polish

| Item | Status | Notes |
|------|--------|-------|
| `STUDIO_SETUP_UX` — Setup progress, EN/ES badges, accordion, time grid | `DONE` | v4.45, missing-only filter + jump-to-gap |
| `CLIP_RENAME` — User labels per greeting | `NOT_STARTED` | |
| `HOTKEYS_1_9` — Keyboard fire slots | `NOT_STARTED` | |
| `ON_CALL_QUICK_FIRE` — Soundboard usable during call | `PARTIAL` | Studio off-call only; on-call = transcript |

## Pass C — Core bug (patient audio)

| Item | Status | Notes |
|------|--------|-------|
| `VIRTUAL_MIC_ROUTE` — Reliable audio to patient path | `BROKEN` | Local sounds fine; patients report garbled/none |
| `DUAL_AUDIO_ELEMENT` — setSinkId + parallel local monitor | `PARTIAL` | Works in dev; fails in production path |
| `CRACKLE_UNDER_STT_LOAD` — Buffer/gain during live transcription | `NOT_STARTED` | Suspected browser overhead |

## Pass D — Soundscape (separate from greetings)

| Item | Status | Notes |
|------|--------|-------|
| `CONNECT_CHIME` — Purse-open on call start | `NOT_STARTED` | |
| `IDLE_COIN_CHIME` — Progressive coin per off-call minute | `PARTIAL` | App-level chime exists; not soundboard |
| `CALL_END_COIN_STACK` — Proportional payout sound | `NOT_STARTED` | |

---

## How to verify today (v4.39)

1. Off-call → studio icon → **Soundboard Studio**
2. **Setup** → record/upload → waveform appears under clip name
3. Wait for health bar (needs Deepgram API key)
4. **▶ Preview** — you only; waveform fills green as it plays
5. **📡 Call Test** — routes to header speaker/output; hear patient path
6. **Play mode** — untested or ⛔ clips preview locally; passing clips go to mic when Test Mode off
