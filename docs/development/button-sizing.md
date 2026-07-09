# Button sizing (v4.84.17)

All interactive buttons share one height. Icon-only buttons are square; text buttons grow horizontally from their label.

## Tokens (`src/index.css` `:root`)

| Token | Default | Use |
|-------|---------|-----|
| `--btn-h` | `26px` | Every button height |
| `--btn-icon` | `26px` | Icon-only width (= height) |
| `--btn-px` | `6px` | Text button horizontal padding |
| `--btn-px-sm` | `4px` | Compact text padding (header chrome) |
| `--btn-radius` | `4px` | Corner radius |
| `--btn-font-size` | `0.62rem` | Header chrome labels |
| `--btn-h-touch` | `44px` | Mobile min touch target (`max-width: 600px`) |

## Rules

1. **Icon-only** — square `var(--btn-icon)` × `var(--btn-h)`. Classes: `.btn-icon`, `.btn-emoji`, `.btn-compact`, `.tiny-btn`, `.header-chrome-btn`, `.habit-dock-pill`, `.connect-interpret-btn` (header).
2. **Text label** — height `var(--btn-h)`, `width: auto`, horizontal padding. Add `.btn-text` or `.header-text-btn`. Accent buttons with labels use `.has-label` on `.btn-emoji`.
3. **No inline `width`/`height`** on buttons — use tokens + classes. Opacity, color, and on-state backgrounds may stay inline.
4. **Exceptions** — `.connect-interpret-btn--idle` (full-width hero CTA off-call). Mobile touch override bumps min size to `--btn-h-touch`.

## Class cheat sheet

```html
<!-- icon -->
<button class="header-chrome-btn" …><GearIcon /></button>

<!-- text -->
<button class="header-chrome-btn header-text-btn">EN→ES</button>
<button class="btn-icon tiny-btn btn-text">Min</button>

<!-- accent with optional label -->
<button class="btn-emoji header-accent-break has-label">BREAK</button>
```

## Files

- Tokens + rules: `src/index.css`
- Header inline cleanup: `src/components/DashboardHeader.js`
- Connect CTA: `src/components/ConnectInterpretButton.js` + `.connect-interpret-btn--idle`
- Wellbeing dock pills: `habit-dock-pill` on Rosary / Desk / Meal widgets
