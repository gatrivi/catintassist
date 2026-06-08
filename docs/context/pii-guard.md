# PII Guard (click-to-copy highlights)

CatIntAssist detects common **personally sensitive info (PII)** in both **transcriptions** and **translations**, highlights it, and makes it **click-to-copy** so you can quickly populate medical interpretation systems.

## What it protects / highlights

- **Phone numbers**
- **SSN** (including digit-by-digit spoken forms)
- **“Last four of your social / SSN”** (phrase guard; highlights the following digits)
- **Dates** (numeric and common month-name formats)
- **Full names** (heuristic: usually after “my name is …”, “patient name is …”)
- **Clinic / hospital names** (heuristic: after “Dr.” / “Clinic” / “Hospital” / “Medical Center” / etc.)
- **Addresses** (heuristic: street number + street type like *St/Ave/Rd/etc.*)
- **Emails** (best-effort)

## Interaction

- Detected PII is highlighted as a clickable span.
- Click (or press Enter/Space) to copy the detected value to clipboard.

## Notes / limitations

- Names, clinics, and addresses use heuristics; false positives are possible, but the goal is **fast copy** for common callflows.
- Emails are “best-effort” regex matches.

