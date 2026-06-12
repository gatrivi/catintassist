# Transcription columns — crib sheet

Study notes for the main view (transcription + translation).  
**App rule as of v4.48.1** — column fix + docs land in **v4.48.2** (planned).

---

## 1. The one table to memorize

**Columns are fixed by language. They never swap.**

| | Left column | Right column |
|---|-------------|--------------|
| **Language** | English | Spanish |

**What goes in each column depends on who is speaking:**

| Speaker | Left (EN) | Right (ES) |
|---------|-----------|------------|
| **English** | transcription (white) | translation (gray, italic) |
| **Spanish** | translation (gray, italic) | transcription (white) |

Mnemonic: **EN left, ES right always.** Transcript chases the speaker’s language into the matching column.

---

## 2. What this is NOT

| Thing | What it does | Swaps columns? |
|-------|----------------|----------------|
| **`toggleLanguage()` / `sttLanguage`** | Forces Deepgram to prefer EN or ES socket for ~30s | **No** |
| **`is-reverse` CSS (current code)** | Tries to put transcript/translation in the right columns when `lang=es` | Implements the table above — **if `lang` is correct** |
| **Future “column language” setting** | Would let user pick e.g. ES-left / EN-right | **Not built** — no UI for this today |

---

## 3. Hidden STT override (not column swap)

- **State:** `sttLanguage` cycles `auto` → `en` → `es` → `auto`
- **Hotkeys** (in `App.js`): `Space`, `Alt+Space`, `Esc` (when not typing in an input)
- **Effect:** `langModeRef` in `useDeepgram.js` overrides the “which socket wins” tie-break
- **UI:** No visible button — props go to `DashboardHeader` but are unused there
- **Does not change:** left=EN, right=ES

---

## 4. Mic Test vs tab audio

| Mode | How to enable | Audio source |
|------|----------------|--------------|
| **Production** | 🎤 off (default) | Browser tab (`getDisplayMedia`) |
| **Mic Test** | 🎤 on next to Connect | Your microphone (`getUserMedia`) |

Mic Test = local dev / practice without hooking another tab. Setting persists in `localStorage` (`catint_mic_test_mode_v1`).

---

## 5. Visual styling

| Role | Color | Style |
|------|-------|-------|
| Transcription | `#ffffff` white | normal |
| Translation | `#a1a1aa` gray | italic (`.bubble-line-translation`) |

Number-word conversion (`convertEnglishNumberWords`) runs only on **English lane content** (left column text), so Spanish “once” (eleven) is not mangled.

---

## 6. Bug you saw (first message EN on the right)

**Symptom:** English speech, white text on the **right** (Spanish column).

**Cause chain:**
1. Two Deepgram sockets (EN + ES) both hear the stream
2. Early ES junk packet wins tie-break → bubble gets `lang: 'es'`
3. `reverse={cap.lang === 'es'}` → layout thinks Spanish speaker
4. Transcript (still English) renders white on the right

**Planned fix (v4.48.2):**
- Safer tie-break in `useDeepgram.js` (prefer socket that fired; prefer non-empty lane)
- Refactor `TranslatedBubble` to explicit `bubble-col-en` / `bubble-col-es` (no CSS grid swap magic)
- Document rule in `docs/agents/02_MAINVIEW.MD` + code comment

---

## 7. Key files (when debugging layout)

| File | Role |
|------|------|
| `src/components/TranscriptionBoard.js` | Bubble UI, columns, `TranslatedBubble` |
| `src/hooks/useDeepgram.js` | Captions, `lang`, dual sockets, tie-break |
| `src/hooks/useTranslate.js` | Translation per bubble; sticky lang pair |
| `src/index.css` | `.translated-bubble-row`, `.is-reverse` grid rules |

---

## 8. Quick self-test (Mic Test)

1. `npm start` → localhost:3000
2. 🎤 on → Connect → allow mic
3. Speak English → **white EN left**, **gray ES right**
4. Speak Spanish → **gray EN left**, **white ES right**

If EN speech shows white on the right → `lang` detection bug, not “wrong column design.”

---

## 9. Where docs live in this repo

| Location | Audience | Purpose |
|----------|----------|---------|
| **`AGENTS.md`** (repo root) | Cursor agent | Always-on rules, priorities, completed tasks |
| **`docs/agents/`** | Cursor agent | Task-scoped specs (`02_MAINVIEW.MD`, `CURSOR.md`, soundboard, etc.) |
| **`docs/handbook/`** | **You** | Short human study / getting-started notes (this file) |
| **Root `*.md`** | Mixed | Scoreboard UX notes, adventures — older / ad hoc |

**Agent routing:** `docs/agents/CURSOR.md` says which files to touch per task.  
**Your routing:** `docs/handbook/` = read on break; no need for agents unless you link it in a task.

**To make agents follow a rule:** put invariant in `AGENTS.md` or `.cursor/rules/`, plus one line in `CURSOR.md` under the STT row, plus a comment in `TranscriptionBoard.js`.

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **Transcription** | What Deepgram heard (source speech) |
| **Translation** | `useTranslate` output in the other language |
| **`cap.lang`** | Detected speaker language (`en` or `es`) on a bubble |
| **Bubble / row** | One line in the scroll area: EN col + rail + ES col |
| **Rail** | Center strip: T/P/R dots, word count, play button |
| **Live bubble** | `isFinal === false` — still streaming; no height clamp |

---

*Last updated: plan for v4.48.2 column fix. Bump this file when that ships.*
