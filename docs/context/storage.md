# Storage & sync

## Not a traditional database

| Layer | Tech | Holds |
|-------|------|-------|
| **localStorage** | Browser | Stats, settings, timelines, lang prefs, pinned msgs |
| **IndexedDB** | `idb-keyval` | Caption history (`catint_captions_v2`) |
| **ntfy.sh** | HTTP push | Optional stats backup (topic from API key hash) |

## Cloud sync

`SessionContext.pushState()` posts to `ntfy.sh/catint_sync_*` every 60s when Deepgram key present. Pull on mount if local daily minutes empty.

## PWA updates

`public/version.json` + service worker. `AppUpdateBanner` prompts installed users to reload.
