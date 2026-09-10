# MLS Call Log Import — September 2026 (Sep 1–9)

Paste-ready transcription of `C:\Users\DevTrivi\Documents\0mls\20-09-Sep` screenshots,
verified against the app's parser (`src/utils/mlsSepImportVerify.test.js`).

## How to import
1. Open the app → **Settings → Data → Company call log import**.
2. Copy **all** of `call-log-paste.txt` into the textarea.
3. Preview should show **6 days** with the totals below → **Apply to scoreboard**.
4. Scoreboard, deficit chip, catch-up plan and heatmap repaint automatically.
   Re-applying is safe (idempotent — signed deltas, past days overwritten).

## Expected day totals (banked = billable minutes)

| Day | Platform header | Banked | Calls banked | Notes |
|-----|-----------------|--------|--------------|-------|
| Sep 1 | 181m / 17 calls | **181** | 8 rows | ⚠️ 1 filler row (ID `0`, 09:00 AM, +135m) |
| Sep 2 | 70m / 8 calls | **69** | 7 rows | ⚠️ 1 filler row (+29m); 1 real call is non-billable (1m) → banked excludes it |
| Sep 3 | 193m / 15 calls* | **193** | 18 rows | complete, all real |
| Sep 4 | 202m / 11 calls | **202** | 11 rows | complete, all real |
| Sep 7 | 0m / 0 calls | — | — | day off, nothing to import |
| Sep 8 | 179m / 13 calls | **179** | 13 rows | complete, all real |
| Sep 9 | 157m / 11 calls | **157** | 11 rows | complete, all real |

*platform chip said 15 but the table lists 18 calls summing exactly 193 — table wins.

## Disclosures (the non-shinobi bits)
- **Sep 1 & 2 screenshots are scroll-truncated** (missing 10 and 2 calls). Filler rows
  (customer ID `0`, placed 09:00 AM, non-overlapping) top the days up to the exact
  header minute totals. Money/goal math is exact; those two days' timeline *shapes*
  are approximate, and per-call detail for the hidden calls is absent.
  For 100% per-call fidelity, re-capture those two days fully and re-transcribe.
- Sep 2 header says 70 total minutes; the app banks **billable** minutes only
  (same as pay) → 69.
- Pay column is $0.00 everywhere; money in the app is derived as billable mins × $0.13/min.
