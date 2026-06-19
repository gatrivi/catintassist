# CatIntAssist — How to use it (v4.51.0)

**Welcome to CatIntAssist**, the cat's interpreter assistant.

**Languages:** English ↔ Spanish (more coming soon).

---

## The three steps (that's it)

### Step 1 — Connect to the conversation tab

Press the **green button** that says **"Click to connect tab"**.

Your browser will ask you to pick a tab. Choose the tab where the phone call or video chat is happening.

If the browser asks, check **"Share audio"**.

> In plain English: *Press here to connect to another browser tab where a conversation to interpret is happening.*

### Step 2 — Start interpreting

When the tab is connected, press the green button again. It will say **"Start interpreting"**.

Now you will see live transcription and translation.

### Step 3 — Stop when done

Press the **red stop button** when the call ends.

---

## On a phone, or no tab to share?

1. Tap the **mic button** (🎤) next to the green button.
2. Then press **"Click to connect tab"** — it will use your microphone instead.

---

## First-time setup (one time only)

1. Click the **gear** (top-right corner).
2. Paste your **Deepgram API key**.
3. Close Settings and follow the three steps above.

If your key is already in `.env` as `REACT_APP_DEEPGRAM_API_KEY`, you can skip this.

**Production translation:** Settings → Translation → paste a **DeepL API key** for reliable EN↔ES (free tier works). Without it, free mirrors may fail or rate-limit.

## Layout (v4.52.0)

Settings → **Layout** tab: swap interpret pane vs scoreboard when waiting for a call.
Default: interpret on top (80%), scoreboard below (20%).

---

1. `npm install`
2. Put keys in `.env`
3. `npm start`
4. Restart after `.env` changes
