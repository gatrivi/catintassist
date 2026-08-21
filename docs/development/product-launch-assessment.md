# Product Launch Assessment — CatIntAssist (v4.85.0)

**Date:** 2026-08-21 · **Question:** can this be sold to voice interpreters?

**Verdict: YES — sellable as a paid BYOK desktop-web tool for medical interpreters, after the items in §3.** The engineering core is unusually strong for an indie product: daily real-world use, 57 passing test files, recovery UX built from live-call friction, and a privacy story (local-first transcripts, prefs-only cloud sync) that is genuinely better than typical SaaS.

---

## 1. What the product is

A browser workspace for English↔Spanish medical interpreters: live bilingual captions (Deepgram streaming, user's key), translation lanes, call-state recovery, number protection, productivity scoreboard, soundboard. BYOK = no per-minute server cost, no PHI touching your servers — the single biggest compliance simplifier for a solo seller.

## 2. Done (release-blocking, shipped v4.85.0)

| Item | Evidence |
|---|---|
| First-run terms consent gate (blocks app + Firebase init until agreed; version-tracked re-prompt) | `App.js` `LegalConsentGate` · `src/utils/legalConsent.js` |
| In-app legal text: Terms · Privacy · Medical disclaimer · Data & Keys | `src/content/legal.js` · Settings → Legal |
| BYOK disclosure matching actual data flows | legal "Data & API Keys" + `docs/compliance/api-keys.md` |
| LICENSE (personal-use, all rights reserved) | `LICENSE` |
| Test suite runnable on Windows (path-casing bug fixed — `npm test` previously found **zero** tests) | `scripts/test-in-batches.js` |
| Build + 57 test files green | `npm run build` · `npm test` (2026-08-21) |

## 3. Remaining before charging money

**Business (you must decide/do — cannot be coded):**
1. **Pricing & billing.** Recommended: subscription via Lemon Squeezy/Paddle/Gumroad (merchant-of-record handles sales tax/VAT) gating a license key the app checks, OR sell "seats" manually at first (10 customers don't need Stripe). Do NOT proxy Deepgram traffic at v1 — BYOK is the compliance moat.
2. **Legal counsel pass** on `src/content/legal.js` (~1 h of a lawyer's time; the text is structured and accurate but is not legal advice).
3. **Deepgram affiliate/partner deal** — every customer must open a Deepgram account; negotiate referral revenue or bundled credits.

**Technical (small, non-blocking):**
4. Verify soundboard passthrough on a real call stack (`docs/soundboard/README.md`) — patient-audio risk.
5. Phase 0 STT checklist smoke (`docs/ROADMAP.md`) — split-translate + zombie re-attach on the real stack.
6. License-key check (one fetch to the billing provider's API on boot; graceful offline grace period).

**Manual QA:** one full live interpreted call at 900×600 on the deploy target.

## 4. Distribution

- Deploy: Vercel project already linked (`.vercel/`). PWA installable.
- Positioning: "the caption workspace built by a working medical interpreter" — the number-protection, zombie-recovery, and 900×600 density are the differentiators no generic transcription tool has.
- First channel: interpreter communities (NCIHC, interpreter Facebook/Discord groups), offer a 14-day trial.

## 5. Honest risks

- **CRA/react-scripts 5 is EOL** — fine for now; plan a Vite migration before scaling (docs/api/vite.md notes exist).
- **Single-maintainer product** — support load is real; the in-app diagnostics (Phase 0 dashboard, route diagnostics) reduce it.
- **HIPAA-adjacent fear** can stall sales — the local-first architecture is the answer; lead marketing with it.
