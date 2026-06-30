# CatIntAssist

CatIntAssist is a real-time interpreter workspace built for high-volume English ↔ Spanish medical interpretation. It combines live speech-to-text, bilingual caption organization, audio-route controls, call-state recovery, and productivity tracking in a single React application.

The project is both a working daily-use tool and a portfolio piece: it shows frontend architecture, real-time browser audio handling, API integration, state management, UX iteration under production constraints, and careful handling of sensitive interpreter workflows.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Deepgram](https://img.shields.io/badge/STT-Deepgram-13EF93)
![Status](https://img.shields.io/badge/status-active%20daily%20use-10B981)

---

## What it does

CatIntAssist helps an interpreter stay oriented during live calls by turning fast, overlapping speech into a structured bilingual workspace.

Core workflow:

1. Connect the audio source for the interpreter session.
2. Stream speech to STT providers.
3. Display live English / Spanish captions in a readable two-column transcript pane.
4. Track call state, timing, silence, reconnection status, and daily/monthly productivity.
5. Provide recovery controls when tab capture, virtual cable routing, or STT connectivity fails.

---

## Why it exists

Medical interpretation is cognitively heavy: the interpreter must listen, retain, translate, speak, manage interruptions, and maintain accuracy under time pressure. CatIntAssist reduces load by making the call state and recent speech visible without replacing the interpreter.

The app is designed around practical constraints from real daily use:

- Small screens and crowded browser windows.
- Live calls where recovery controls must be visible immediately.
- Browser audio permissions and tab-sharing limitations.
- Need for fast fallback when experimental routing fails.
- Sensitive content where transcripts and keys must be handled cautiously.

---

## Key features

### Live bilingual caption workspace

- English ↔ Spanish caption lanes.
- Readable transcript pane optimized for active calls.
- Sticky pinned transcript support.
- Smart formatting for long utterances, numbers, and interpreter-relevant text.
- Language-pair controls for default EN/ES work and future multilingual extension.

### Audio capture and routing controls

- Tab-share capture flow for current stable use.
- Optional virtual-cable input mode for lower-overhead routing experiments.
- Manual fallback from virtual cable back to tab sharing.
- Audio route status bar for microphone, input source, output route, and STT status.
- Local and routed test tones for fast audio sanity checks.

### Call-state recovery

- Connection diagnostics for STT sockets and audio stream state.
- Reconnect / zap controls for stale or failed streams.
- Zombie-call recovery when a session state needs to be re-attached.
- Visible error states for high-pressure recovery during live work.

### Productivity and focus tools

- Call timer and session earnings.
- Daily and monthly progress tracking.
- Break nudges and silence tracking.
- Scoreboard views for work pacing.
- Optional soundboard and personal utility widgets.

### Privacy-aware settings

- User-provided API key flow.
- Settings sections for Deepgram, language, behavior, layout, display, and audio.
- Firebase-backed account shell intended for UI preferences and soundboard metadata, not medical transcript storage.

---

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Create React App |
| Styling | CSS modules-by-convention in `src/index.css`, glass-panel UI system |
| State | React hooks, custom contexts, localStorage, IndexedDB via `idb-keyval` |
| Auth / sync | Firebase Auth, Firestore preference sync |
| Speech-to-text | Deepgram streaming integration |
| Audio | Browser MediaDevices, tab capture, output sink selection, virtual-cable routing support |
| Testing | React Testing Library, Jest via `react-scripts` |

---

## Architecture overview

```text
Browser audio source
  ├─ Tab share capture
  ├─ Microphone test mode
  └─ Virtual cable input mode
        ↓
Deepgram streaming hooks
        ↓
Caption engine / transcript reducers
        ↓
React workspace UI
  ├─ DashboardHeader
  ├─ AudioRouteStatusBar
  ├─ TranscriptionBoard
  ├─ Scoreboard / productivity widgets
  └─ SettingsPanel
```

Important code areas:

| Path | Purpose |
| --- | --- |
| `src/App.js` | Main application shell and top-level wiring |
| `src/hooks/useDeepgram.js` | STT stream lifecycle and connection state |
| `src/hooks/useAudioSource.js` | Audio source mode selection and routing decisions |
| `src/components/DashboardHeader.js` | Primary call controls and compact live status UI |
| `src/components/AudioRouteStatusBar.js` | Audio/STT route health strip |
| `src/components/TranscriptionBoard.js` | Main bilingual transcript surface |
| `src/components/SettingsPanel.js` | User-facing configuration panels |
| `src/utils/captionEngine.js` | Transcript reduction, overlap cleanup, and caption shaping |
| `docs/` | Deeper architecture notes, handoff docs, onboarding, roadmap |

---

## Getting started

### Prerequisites

- Node.js 18+
- npm
- A Deepgram API key for live STT testing
- Chrome or Chromium-based browser for best tab/audio support

### Install

```bash
npm install
```

### Run locally

```bash
npm start
```

The app runs through Create React App's local development server.

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

---

## Environment and runtime configuration

Most sensitive runtime configuration is handled through the app settings UI rather than committed files.

Typical setup:

1. Open the app.
2. Open Settings.
3. Add a Deepgram key through the Deepgram / key vault section.
4. Choose the audio source mode:
   - **Tab share** for the stable default path.
   - **Virtual cable** for experimental cable routing.
5. Use the audio route status strip to confirm input, output, and STT status.

Do not commit real API keys, transcripts, or call data.

---

## Documentation

The historical internal docs live under [`docs/`](docs/README.md). Useful entry points:

- [`docs/onboarding/quickstart.md`](docs/onboarding/quickstart.md)
- [`docs/architecture/flow.md`](docs/architecture/flow.md)
- [`docs/transcription-pane/README.md`](docs/transcription-pane/README.md)
- [`docs/scoreboard/README.md`](docs/scoreboard/README.md)
- [`docs/soundboard/README.md`](docs/soundboard/README.md)
- [`docs/tts/README.md`](docs/tts/README.md)

---

## Recruiter notes

This project demonstrates:

- Building and maintaining a non-trivial React app used in a real workflow.
- Designing dense UI for stressful, time-sensitive work.
- Working with streaming APIs and browser audio constraints.
- Improving reliability through diagnostics, fallback paths, and recovery controls.
- Managing sensitive-data boundaries in a frontend-heavy application.
- Iterating quickly while preserving a working production path.

The app is intentionally practical rather than toy-sized: many features come from real friction encountered during live interpretation work.

---

## Roadmap

Near-term areas:

- Stronger automated screenshot regression tests for mobile header layout.
- Cleaner audio-device onboarding and virtual-cable setup guidance.
- Better separation of experimental audio routing from stable tab-share flow.
- More focused tests around caption reduction and connection recovery.
- Further documentation cleanup for outside contributors.

---

## Disclaimer

CatIntAssist is an interpreter productivity tool. It is not a medical device, clinical decision tool, or replacement for a qualified interpreter. Users are responsible for complying with workplace, privacy, and client requirements when using any transcription or audio-processing tool.

---

## Author

Built by Gaston Alejandro Trivi.

- GitHub: [gatrivi](https://github.com/gatrivi)
- LinkedIn: [linkedin.com/in/gatrivi](https://www.linkedin.com/in/gatrivi)
