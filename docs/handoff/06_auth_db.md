# Handoff: Auth + DB (Phase 3 — read only)

## Problem
Today everything is browser-local. User wants proper login + shared corrections/glossary eventually.

## Current persistence map
| Data | Storage | Key / location |
|------|---------|----------------|
| Daily/monthly stats | localStorage | `catintassist_stats` |
| Transcript corrections | localStorage | `catint_corrections_v1` |
| Deepgram key (encrypted) | localStorage | `dg_cipher`, `dg_salt`, `dg_iv` |
| Translation API keys | localStorage | `DEEPL_API_KEY`, `OPENAI_API_KEY` |
| Soundboard clips | IndexedDB | via `idb-keyval` |
| Pinned messages | localStorage | `catint_pinned_msgs` |
| Pane order | localStorage | `catint_pane_order_v1` |

## Stack options (not locked)
**Supabase:** Postgres + auth + RLS. Good for corrections table, per-user stats, shared medical glossary with row-level policies. Fits React SPA with anon key + JWT.

**Firebase:** Auth + Firestore. Faster bootstrap, weaker relational queries for stats history. Good if realtime sync matters more than SQL reports.

## Recommended migration order
1. Auth shell (login/logout UI, session token)
2. Sync `catintassist_stats` → `user_daily_stats` table
3. Sync `catint_corrections_v1` → `corrections` table (shared optional flag)
4. Medical glossary → `medical_terms` table
5. Keep Deepgram/DeepL keys **client-side encrypted** — do not move raw keys to server without user approval

## Touch only (when approved)
- New `src/services/` or `src/api/` module
- New env vars: `REACT_APP_SUPABASE_URL`, etc.
- Settings login panel

## Out of scope for v4.56
Any DB implementation. Phase 1 corrections stay local (`04_transcript_corrections.md`).

## Acceptance (future)
- Login persists across devices
- Corrections opt-in sync
- Offline fallback to localStorage
- No regression to on-call interpret flow
