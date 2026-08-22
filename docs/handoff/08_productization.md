# 08 — Productization / Launch (2026-08-21)

**Status:** beta live with access gate. Next agent: do NOT re-audit — everything below is verified on production.

## Where things stand

| Piece | State |
|---|---|
| **v4.85.0** | legal pack: first-run consent gate (`LegalConsentGate` in `App.js`, outside providers so Firebase never boots pre-consent), in-app legal text (`src/content/legal.js` — single source), Settings → Legal tab, `LICENSE`. Version-tracked: bump `LEGAL_VERSION` → all devices re-prompt. |
| **Access gate** | `middleware.js` (repo root) — Vercel Edge Middleware, gates ALL routes incl. JS bundle. Users: `mariano:pividori`, `gaston:trivi` in Vercel env `APP_AUTH_USERS`; `APP_AUTH_SECRET` derives the 1-year HttpOnly device cookie (`cia_device`). Missing env → fail-closed 503. **Gotcha:** plain edge Request has no `.cookies` — parse the header (already fixed; don't regress). |
| **Deploy** | `npx vercel --prod --yes` from repo root (CLI authed as `gatrivi`). Live: `catintassist.gatrivi.com` + `catintassist.vercel.app`. **Real users (Mariano, Gastón) work on this URL daily** — treat deploys as production changes, verify after. |
| **Mic/mobile** | Verified end-to-end on prod 2026-08-21 — see [`../onboarding/mic-mode-phone-assistant.md`](../onboarding/mic-mode-phone-assistant.md) "Verified" section. Watch item there: stop→CONNECT inside the 15s HIPAA grace sometimes doesn't re-dial sockets (reload always works). |
| **Tests** | `npm test` = 57 files green. NOTE: `scripts/test-in-batches.js` has a Windows true-case path fix — if tests report "No tests found", that fix was lost. |
| **Assessment** | [`../development/product-launch-assessment.md`](../development/product-launch-assessment.md) — sell verdict + remaining business gaps. |

## Open items (priority)

1. **Real-call QA on phone** — user must run one live interpreted call: mic mode, soundboard passthrough, Phase 0 checklist ([`../ROADMAP.md`](../ROADMAP.md)).
2. **Lawyer pass** on `src/content/legal.js` before charging money (text is structured + accurate to data flows, not counsel-reviewed).
3. **Billing** — decision pending: merchant-of-record (Lemon Squeezy/Paddle) + license key check on boot. Do NOT proxy Deepgram traffic (BYOK is the compliance moat).
4. **Reconnect race** — reproduce + fix the grace-window stop→connect no-dial (entry: `useDeepgram.js`, `SessionContext.js` HIPAA grace).
5. **Vite migration** — deferred until CRA hurts; notes in [`../api/vite.md`](../api/vite.md).

## Verify after any deploy

1. Anonymous visit → login page (not app), bundle path returns login HTML
2. Login → consent gate (first device only) → dashboard renders
3. Mic mode CONNECT → EN/ES sockets open, transcript pane live
