# Button sizing + colors (v4.84.29)

All interactive buttons share one height. Icon-only = square. Colors follow **meaning**, not feature brand.

## Size tokens (`:root`)

| Token | Default | Use |
|-------|---------|-----|
| `--btn-h` / `--btn-icon` | `26px` | Height; icon width |
| `--btn-px` / `--btn-px-sm` | `6px` / `4px` | Text padding |
| `--btn-radius` | `4px` | Corners |
| `--btn-h-touch` | `44px` | Mobile tap (`max-width: 600px`) |

## Color tokens (semantic)

| Role | Tokens | Meaning |
|------|--------|---------|
| **live** | `--btn-live*` | Patient path / confirm / playing (connect green) |
| **test** | `--btn-test*` | Local preview / blocked caution (hold amber) |
| **danger** | `--btn-danger*` | Record / stop / delete |
| **chrome** | `--btn-chrome*` | Neutral toggles, setup, filters, edit |

Matches header accents: connect → break → hold → logoff. **No gold/purple/indigo as action colors.**

## Soundboard mapping

| Control | Class / role |
|---------|----------------|
| ▶ local | `--preview` → **test** |
| 📡 call route | `--call` → **live** |
| 🎙/⏹ record | `--record/--stop` → **danger** |
| ✏️ edit, filters, upload, setup | **chrome** |
| I/O “Soundboard” entry | chrome; `.is-open` → **live** |
| On-call tile playing | **live**; blocked → **test** |

### Clip action order (left → right)

`Record/Stop` → `Preview` → `Call` → `Edit`

## Rules

1. Icon-only → square; text → `width: auto` + `.btn-text` / `.header-text-btn`
2. No inline `width`/`height`/`background` for theme — use tokens
3. Amber = caution/test only; green = live only — never both for the same risk

## Files

- Tokens: `src/index.css` `:root`
- Studio: `.sb-btn--*`, `.audio-route-soundboard-btn`, `.workspace-view-btn`
- Clip order: `src/components/GreetingsPanel.js`
