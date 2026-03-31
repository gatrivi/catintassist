# Adventures in Coding with Gatrivi

A collection of architecture lessons, unexpected state failures, and frontend poltergeists encountered during the development of a high-density, real-time medical interpreter dashboard.

---

## 1. The Cloud Sync Purge: A Lesson in Race Conditions

**The Bug:** Pressing `Ctrl+F5` mid-call entirely wiped out the user's monthly progress metrics.
**The Climax:** The application was using a public API (`ntfy.sh`) as a background cloud-sync mechanism. When the browser was refreshed, React instantly initialized a blank, zero-minute baseline state. Because React executes its `useEffect` hooks incredibly fast, it took that blank `0` state and proactively blasted it to the cloud **before** the cloud had time to send back the *actual* saved data down to the app! The app then received its own freshly uploaded `0` and definitively saved it, nuking a month's worth of hard work in less than 200 milliseconds.
**The Lesson:** Never trust asynchronous cloud endpoints to initialize critical application state if those same components also push changes instantly. 
**The Fix:** Ripped out the cloud logic. Hardened the app by moving all timer logic to synchronously write natively mapping into `localStorage`. `Ctrl+F5` now seamlessly resumes the app mid-call with single-millisecond precision.

---

## 2. The Dial Modal Gravity Well: CSS Positioning Nightmares

**The Bug:** A 580-pixel wide Goal Configurator "Dial" suddenly disappeared when launched on a 600-pixel wide monitor.
**The Climax:** The wheel was set as `position: absolute; right: 0` and attached natively to a small "Today" stat card in the middle-left of the screen. Because it was pinned to align perfectly with the *right* side of that card, drawing its massive 580px width violently pushed the UI box straight leftwards—physically shoving it entirely outside the boundaries of the user's 600px monitor.
**The Lesson:** `position: absolute` is highly dangerous for large dynamic modals when nested deep inside small, heavily padded flexbox cards. 
**The Fix:** Decoupled the modal from its parent card by declaring it `position: fixed`. Anchored it strictly to the dead center of the viewport via `top: 50%; left: 50%; transform: translate(-50%, -50%)`, and enforced a heavy `max-width: 500px` boundary so it mathematically could not exceed the display constraints.

---

## 3. The Phantom TypeError: A Real-Time React Crash

**The Bug:** The entire livestream transcription app completely froze, appearing totally broken and unresponsive without warning.
**The Climax:** The interpreter app relies on a high-speed Deepgram WebSockets connection. I attempted to implement a rule to gracefully cut paragraphs after "25 words". However, when the app automatically created a fresh new bubble for the next 25 words, that fresh bubble didn't natively have a `.text` string populated yet. When the code aggressively tried to check the array `.length` of the previous bubble, it evaluated against `undefined`. Javascript famously crashes with `TypeError: Cannot read properties of undefined (reading 'length')`. Because this crash occurred inside a WebSocket's synchronous `onmessage` event listener, it instantly and fatally killed the listener. The socket stayed open, but React went entirely deaf.
**The Lesson:** Optional chaining (`?.`) is notoriously dangerous when combined with further strict properties. `text?.split().length` means if `text` is undefined, the chain returns `undefined`, and asking for the `.length` of `undefined` causes a fatal execution halt.
**The Fix:** Coerced the evaluation safely: `(prevBubble.text || '').split().length`. 

---

## 4. The Dual-Pipeline Poltergeist: Ghosting Audio Streams

**The Bug:** When messages were automatically split, the slower translation pipeline was aggressively duplicating identical sentences from the previous bubble into the new bubble.
**The Climax:** The application runs two websockets simultaneously (English and Spanish) to race translation models. Naturally, one language often finishes 500ms slower than the other! So, when the English pipeline hit a natural pause and declared *“End of string!”*, the React UI forcefully chopped the bubble up and created a fresh empty input box. However, the Spanish pipeline was still casually finishing its translation for the *old* string... and blindly dumped its residual buffer—representing the old sentence—straight into the freshly created new bubble!
**The Lesson:** You cannot artificially slice a real-time concurrent multi-pipeline data stream simply because the *fastest* pipe reached a milestone. The slower pipes will instantly desynchronize and spill their guts into the wrong containers.
**The Fix:** Removed artificial chunk slicing entirely. Implemented a strict `1000ms` global silence detection algorithm (`timeSinceLast > 1000`). The UI now only creates a new bubble when *both* pipelines have been absolutely silent for one full physical second (a natural breath), guaranteeing they are perfectly synchronized before slicing.

---

*Written collaboratively in real-time during the development of CatIntAssist by Gatrivi & Antigravity (Google DeepMind).*
