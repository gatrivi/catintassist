# API Keys — Client-Side Model

CatIntAssist runs **in the browser**. Third-party keys (Deepgram, DeepL, OpenAI, Google translate) are entered by the operator and stored locally.

## Where keys live

| Key | Storage | Notes |
|-----|---------|-------|
| Deepgram | `DeepgramKeyVault` + `deepgramRuntimeKey.js` | Optional encrypted remember |
| Translation engines | `translationRuntimeKeys.js` / Settings → Translation | Plain localStorage keys |
| Deepgram health check (soundboard) | Same as STT key | Used only for greeting legibility test |

## Industry standard gap

**Enterprise products** usually proxy API calls through a backend so keys never ship to end users. CatIntAssist **deliberately** keeps keys client-side for solo interpreter use (no server bill, works offline-ish for UI).

## Risks

- Keys visible in DevTools / extensions with storage access
- Shared computer = shared keys
- XSS in any dependency could exfiltrate keys (standard SPA risk)

## Mitigations today

- Keys not committed to git (`.env` local only)
- Vault encryption option for Deepgram remember-me
- No keys in cloud sync payload (Account tab)

## If you productize

1. Backend proxy with per-user JWT
2. Rate limits + audit log per org
3. Never log request bodies server-side without BAA

See [`operational-notes.md`](operational-notes.md) for PHI handling.
