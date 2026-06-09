# Context index (TLDR)

**CatIntAssist** — real-time interpreter cockpit: transcription (80% viewport), translation, earnings HUD (20%).

## Core rules

- **80/20 layout**: transcript dominates; scoreboard compact
- **Version tag** top-right on every build
- **Connect**: single-tap 🎤 mic · double-tap 📺 tab (interpreter EN↔ES)
- **Labels**: hidden by default on scoreboard; ⚙️ settings to show
- **Tokens**: keep agent edits small; docs TLDR

## Files

| Doc | Contents |
|-----|----------|
| [rules.md](./rules.md) | Agent instructions (from `agents.md`) |
| [connect.md](./connect.md) | Audio capture & languages |
| [storage.md](./storage.md) | Persistence & sync |
| [scoreboard.md](./scoreboard.md) | HUD metrics & UX |
| [pii-guard.md](./pii-guard.md) | Click-to-copy highlights for sensitive info |
| [onboarding.md](./onboarding.md) | PWA install, first visit, updates |

## App icon

Dog photo: `public/20180305_210729.jpg` → PWA icons `web-app-manifest-*.png`, `dog-icon.svg`.

## Version

`package.json` version + `public/version.json` buildId (generated prebuild). Installed users see **Update** banner when buildId changes.
