# Vanish / derender trace (v4.84.2)

When words disappear after paint, filter console for **`[CAT VANISH]`**.

```js
window.__catintVanishTrace   // ring buffer
window.__catintVanishOn = false  // mute
```

## Common reasons

| reason | meaning |
|--------|---------|
| `overlap_strip` | STT overlap removal dropped leading words |
| `hallucination_*` | finalize filler wipe / stutter prune |
| `display_digit_stitch` / `display_phone_ssn_reformat` | live digit reshape |
| `live_to_sealed_swap` | StableTextMorph → InteractiveText remount |
| `caption_bubble_split` | sentence/comma seal split |
| `morph_word_diff` | StableTextMorph saw delete/replace |
| `ui_blank_caption_skipped` | row present but empty text |

## Protector TLDR (v4.84.7)

- **Phone/SSN:** format at display (sentinel may skip)
- **Date / dosage / money:** one highlight/copy unit each
- **Sentinels:** display brake on stitch/phone for address/email/spelling/date/dosage…
- **Spelling:** spoken paragraph + trailing Spelled chip (no newline remount)
- Full plan: [`sensitive-data-approach.md`](sensitive-data-approach.md)
