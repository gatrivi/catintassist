# Legacy: Adventures in Coding with Gatrivi

A collection of architecture lessons, unexpected state failures, and frontend poltergeists encountered during the development of a high-density, real-time medical interpreter dashboard.

---
## 1. The Cloud Sync Purge: A Lesson in Race Conditions
**The Bug:** Pressing `Ctrl+F5` mid-call entirely wiped out the user's monthly progress metrics.
**The Fix:** Ripped out the cloud logic. Hardened the app by moving all timer logic to synchronously write natively mapping into `localStorage`.

---
## 2. The Dial Modal Gravity Well: CSS Positioning Nightmares
**The Bug:** A 580-pixel wide Goal Configurator “Dial” disappeared when launched on a 600-pixel wide monitor.
**The Fix:** Decoupled modal by using `position: fixed` anchored at the viewport center and enforced `max-width: 500px`.

---
## 3. The Phantom TypeError: A Real-Time React Crash
**The Bug:** `TypeError: Cannot read properties of undefined (reading 'length')`.
**The Fix:** Coerced safely: `(prevBubble.text || '').split().length`.

---
## 4. The Dual-Pipeline Poltergeist: Ghosting Audio Streams
**The Bug:** Slower translation pipeline spilled residual buffer into the newly created bubble.
**The Fix:** Removed artificial chunk slicing; used strict `1000ms` global silence detection so both pipelines are silent before slicing.

