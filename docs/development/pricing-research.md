# Pricing Research & Recommendation (2026-08-21)

Managed-API model ("user pays us, we pay Deepgram/Azure"). Sources checked Aug 2026:
Deepgram list pricing, Azure Translator, DeepL API plans, Ava, Otter.ai, Boostlingo.

## 1. Our real costs (COGS)

| Input | Price | Note |
|---|---|---|
| Deepgram Nova-3 **streaming**, pay-as-you-go | **$0.0077/audio-min** | [markaicode](https://markaicode.com/pricing/deepgram-pricing/), [brasstranscripts](https://brasstranscripts.com/blog/deepgram-pricing-per-minute-2025-real-time-vs-batch) |
| Deepgram Growth plan (commit) | **$0.0065/audio-min** | same sources |
| New Deepgram account credit | $200 free (~45k min) | covers beta phase entirely |
| Azure Translator F0 | **FREE 2M chars/month, recurring** | covers a full-time interpreter's translation volume; then $10/M chars |
| DeepL API | free tier retired; ~$27.50/M chars overage | not competitive — standardize on Azure |

**Critical multiplier:** the app currently streams **two simultaneous sockets** (EN lane + ES lane) for every call → 2× COGS today: `$0.0154/min` PAYG.

**Usage reality check** (medical interpreter, 20 workdays):
- Light (2 h/day): 2,400 min/mo → dual-lane $31–37/mo · single-lane $16–18/mo
- Heavy (5 h/day): 6,000 min/mo → dual-lane $78–92/mo · single-lane **$39–46/mo**

**Engineering lever #1:** collapse the two mono lanes into one `nova-3` multilingual/code-switching socket → halves COGS. Do this before selling managed plans.

## 2. What comparable tools charge

| Product | Price | What you get |
|---|---|---|
| **Ava Community** | $14.99/mo ($9.99 annual) | only **3 h premium captions/mo**, 40-min sessions, $4.99/**extra hour** |
| Ava Pro/Enterprise | custom (org sales) | unlimited premium |
| **Otter Pro** | $16.99/mo ($8.33 annual) | 1,200 min/mo transcription (not real-time assist) |
| Otter Business | $30/user/mo | team features |
| **Boostlingo AI Interpreter** | pay-per-minute, "up to 42% less than human" | *replaces* the interpreter (~$1–2/min) — different category, but sets the per-minute anchor high |

Ava's metered math is the key insight: a working interpreter who used CatIntAssist-level hours on Ava would pay **~$150–200/mo** in overage charges. Professionals also routinely pay $99+/mo for AI work tools (AI medical scribes: Freed $99, Nuance DAX far more).

## 3. Buyer context

US medical interpreters (independent contractors) bill agencies roughly $25–60/hour. A tool used every working day that protects accuracy and pacing is an easy write-off if it costs less than one hour of their monthly revenue. **Price to value ($30–80/mo), not to transcript-tool parity ($17/mo).**

## 4. Recommendation

Three tiers, annual = 2 months free:

| Tier | Price | Includes | Est. COGS (single-socket) | Margin |
|---|---|---|---|---|
| **BYOK** | **$19/mo** | everything, bring your own Deepgram key | ~$0 | ~100% |
| **Pro (managed)** | **$49/mo** | app + **40 h/mo STT included**, then $1.50/h; Azure translation included | $15.60–18.48 at cap | ~62–68% |
| **Team** (later) | $39/seat/mo, 3+ seats | Pro + agency dashboard | same | better |

Rationale:
- **$19 BYOK** keeps current users (Mariano/Gastón) paying something from day one with zero infra work, and is the margin-safe floor.
- **$49 managed** undercuts what the same usage would cost on Ava (~$150+) by 3× while keeping >60% margin, and lands below the psychological $50 line. Overage at $1.50/h is still ~8× our marginal cost — self-healing margin if someone does 100 h.
- **Free trial**: 14 days / 3 h managed STT — enough to test on real shifts; costs us <$1/trial.
- Beta users grandfathered: offer founding-user lifetime discount (e.g., $29/mo managed forever) — they're already testing and referring.

## 5. What must be built for managed keys

Minimal, PHI-safe (no audio ever touches our servers):
1. **Token broker** (one Vercel/edge function): auth'd user → short-lived Deepgram session token (Deepgram supports scoped temporary tokens). Client streams direct to Deepgram as today.
2. **Usage metering**: Deepgram returns usage per request id — store per-user minutes (Firestore).
3. **Enforcement**: block token issuance when over quota; show in-app minutes remaining.
4. Billing via merchant-of-record (Lemon Squeezy/Paddle) handling global sales tax.

Est. build: 2–4 focused sessions. The BYOK tier needs none of this and can sell immediately.

## 6. One-time purchase tier: "own the app" (~$250)

Buy CatIntAssist outright with 1 year of API included ("LTD" — lifetime deal).

**Never bundle *uncapped* API into a one-time price.** Year-1 COGS per user (single-socket):

| Usage | 12-mo Deepgram cost (PAYG / Growth) | vs $250 |
|---|---|---|
| Light 10 h/mo | $92 / $78 | ok |
| Mid 20 h/mo | $185 / $156 | eats most of it |
| Heavy 40 h/mo | $370 / $312 | **underwater by ~$120** |

**Workable structure:**
- **Founder License — $249 one-time:** the app for life **+ 12 months of managed API capped at 15 h/month** (fair-use; overage $1.50/h). Worst-case year-1 COGS ≈ $83–104 → **$145–165 gross margin**, and the buyer still saves ~$140 vs Ava's metered math for the same hours.
- After month 12 the license persists but API defaults to **BYOK at no charge** (the app already supports it), or renews convenience API at **$49/year** (~$4/mo, margin-safe). Nobody loses access; you stop subsidizing only their minutes.
- Cash framing: 50 LTD sales ≈ **$12,450 upfront ≈ $9k+ gross margin** — funds the token-broker build and a Deepgram Growth commit (drops COGS another 16%).
- Enforcement: selling "the app itself" from a JS bundle needs license keys bound at login (extend the existing edge middleware: per-user license key instead of shared passwords). Copying the bundle stays technically possible, but the API gate makes pirated copies worthless — the API *is* the moat. The token broker is therefore mandatory for the LTD, not optional.

## 7. Answer in one line

Ladder: Free trial (14d/3h) → **BYOK $19/mo** (sellable now) → **Founder LTD $249 once** (15 h/mo capped year 1; needs token broker + license keys) → **Pro $49/mo managed** self-serve → Team seats later. Before any managed tier: collapse the dual STT lanes to one socket to halve API costs.
