# Operational Notes — PHI & Interpreter Use

**Not legal advice.** For your counsel / compliance officer. CatIntAssist is a **personal interpreter workstation**, not a certified medical device.

## What the app stores locally

| Data | Where | PHI risk |
|------|-------|----------|
| Live transcript bubbles | IndexedDB `catint_captions_v2` | **Yes** — treat as PHI if call content is clinical |
| Translation cache | `localStorage` `trans_cache:*` | **Yes** — fragments of speech |
| Taught corrections | `localStorage` `catint_corrections_v1` | **Maybe** — names/places you fixed |
| Stats / scoreboard | `localStorage` + IndexedDB | Usually no PHI (minutes, $) |
| Soundboard clips | IndexedDB blobs | **Maybe** — prerecorded phrases |
| API keys | localStorage (encrypted vault optional) | **No PHI** — secrets |

## Built-in mitigations (v4.77+)

- **HIPAA grace disconnect** — SessionContext can purge translation cache on call end
- **Clear log** — confirm before wipe; pinned kept separately
- **Client-only** — no server transcript upload unless you enable cloud sync (Account tab = prefs only today)

## Operator checklist (each shift)

1. Confirm you are on the **correct browser profile** (no shared family Chrome)
2. Lock screen when away from desk
3. End call → verify STOP; consider **Clear log** after copying needed numbers
4. Do not screen-share transcript pane without patient consent
5. Backup taught corrections via **Settings → Data** before clearing site data

## Before selling / deploying to others

- [ ] Written BAA with any cloud vendor (Deepgram, DeepL, etc.) — **you** are data controller
- [ ] Privacy policy + terms (link from app shell)
- [ ] Document that API keys are **bring-your-own** and stored client-side
- [ ] Incident plan: remote wipe = clear site data + revoke keys
- [ ] Training: double-click teach does not replace clinical judgment

## Related docs

- [`api-keys.md`](api-keys.md) — key storage model
- [`../development/production-readiness.md`](../development/production-readiness.md) — sellable-app audit
