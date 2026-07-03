# Production Readiness Audit (v4.77.0)

**Goal:** Sellable / industry-standard quality without removing unique interpreter UX (80/20 layout, bubble teach, number protection, terminal chrome).

## Quick links
- [`CHANGELOG.md`](../CHANGELOG.md)
- [`transcription-pane/corrections.md`](../transcription-pane/corrections.md)

---

## Fixed in v4.77.0 ✅

| Issue | Fix |
|-------|-----|
| PWA manifest pointed at **missing** `logo192.png`, `favicon.ico`, etc. | `manifest.json` + `site.webmanifest` use real `favicon.svg`; dark theme colors |
| Duplicate / broken `<link rel="manifest">` in `index.html` | Single manifest + single favicon link |
| `[CLEAR_LOG]` wiped transcript with **no confirm** | `confirm()` dialog; pinned kept |
| Footer buttons missing `type`, `aria-label`, clipboard feedback | a11y labels + `aria-live` status |
| Modal correction editor no focus trap | Tab trap + `aria-modal` |
| `ScrambleText` ignored reduced motion | Instant text when `prefers-reduced-motion` |
| Global animations ignored OS setting | CSS `@media (prefers-reduced-motion: reduce)` |
| Deepgram `console.log` on every WS close in prod | Gated to dev |
| No skip link to main transcript | Skip link → `#main-transcript` |
| Update banner buttons not typed / labeled | `type="button"` + `aria-label` |
| Error screen not announced | `role="alert"` on ErrorBoundary |

---

## P0 — still open (before “sold for real”)

| Item | Notes |
|------|-------|
| **Privacy / terms / HIPAA disclaimer** | Operational notes added — [`compliance/operational-notes.md`](../compliance/operational-notes.md) (not legal advice) |
| **API keys in localStorage** | Documented — [`compliance/api-keys.md`](../compliance/api-keys.md) |
| **Soundboard patient audio** | Verify passthrough on prod stack ([`soundboard/README.md`](../soundboard/README.md)) |
| **Phase 0 STT checklist** | [`ROADMAP.md`](../ROADMAP.md) — split translate, zombie re-attach |

## P1 — polish (non-blocking)

| Item | Notes |
|------|-------|
| More `ElementHint` coverage on transcript footer | Terminal labels kept; hints via hover |
| `main` landmark on soundboard view | Only call view has `#main-transcript` today |
| Corrections export UI in Settings | **Shipped v4.78.0** — Settings → Data |
| E2E smoke test (Playwright) | Manual sanity at 900×600 still primary |

## P2 — later

| Item | Notes |
|------|-------|
| Server-side key proxy | Phase 2 DB — explicit approval |
| Partial glossary / Deepgram bias | [`handoff/04_transcript_corrections.md`](../handoff/04_transcript_corrections.md) |
| Full WCAG audit (axe) | Run before external sale |

---

## Preserve (do NOT “standardize away”)

- 80% transcript / 20% scoreboard layout
- EN left / ES right column lock
- Terminal-style `[CLEAR_LOG]` visible labels (aria explains them)
- Bubble corrections teach flow
- Number protection + click-to-copy
- Call focus / zombie re-attach / double-tap connect

---

## Verify after pull
1. Top-right **v4.77.0**
2. `npm test` + `npm run build`
3. Install PWA — icon loads (no 404 in Network tab)
4. `[CLEAR_LOG]` → confirm appears
5. OS “reduce motion” → live tail text appears instantly
