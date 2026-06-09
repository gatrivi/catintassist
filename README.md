# CatIntAssist — The Cat's Interpreter Assistant

Real-time transcription, side-by-side translation, and a gamified earnings HUD for medical interpreters.

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)
![Deepgram](https://img.shields.io/badge/STT-Deepgram_Nova--2-10b981?style=flat-square)

**App icon:** photo of the cat's dog (`public/20180305_210729.jpg`).

---

## Quick start

```bash
npm install
npm start          # dev — http://localhost:3000
npm run build      # production (writes version.json + service worker)
```

API keys: Deepgram in `.env` as `REACT_APP_DEEPGRAM_API_KEY` or `localStorage` `DEEPGRAM_API_KEY`.

---

## Connect

| Gesture | Mode |
|---------|------|
| **Tap** Connect | 🎤 Device microphone (demos, tablet) |
| **Double-tap** Connect | 📺 Tab audio (interpreter EN↔ES) |

Hold **ENG → SPA** language bar to pick other pairs (e.g. Portuguese → Chinese).

---

## Install (PWA)

Add to Home Screen / Install app. Manifest name: **CatIntAssist — The Cat's Interpreter Assistant**.

When a new build is deployed, installed users see **New app version available — Update**.

---

## PII guard (click-to-copy)

Transcriptions and translations highlight common sensitive data and make it **click-to-copy**:
phone numbers, **SSN** (incl. spoken digit-by-digit), **“last four of your social/SSN”** guard, **dates**, **full names / clinic names** (heuristic), **addresses**, and best-effort **emails**.
---

## Docs (humans & agents)

**Start here:** [docs/README.md](./docs/README.md) → [docs/context/README.md](./docs/context/README.md)

- Rules, scoreboard, connect, storage, onboarding — nested TLDR markdown (saves tokens vs scattered root files)
- Feature deep dives: [docs/agents/](./docs/agents/)

Legacy `agents.md` at repo root still holds task inbox + completed history; new context goes under `docs/context/`.

---

## Storage

- **localStorage** + **IndexedDB** locally
- Optional **ntfy.sh** sync (not a SQL database) — see [docs/context/storage.md](./docs/context/storage.md)

---

## Layout

- **80%** live transcript + translation
- **20%** scoreboard / controls
- Optimized from **900×600** upward

---

*v4.47+ — See version tag top-right in the running app.*
