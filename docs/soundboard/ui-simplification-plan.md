# Soundboard Studio — UI simplification plan (subviews)

Status: PROPOSAL (no code changed). Grounded in a GUI visual pass of build `4e1a5dd` (v4.111.0) at 900×600.
Evidence: `gui-test-screenshots/t1–t4` (Play view, Setup top, expanded card, Setup bottom).

## TL;DR

Split the Studio into **3 subviews — Play / Check / Record**. Today every job (fire, verify, record,
backup) shares one long scroll; the fire-gallery starts below the fold and the checklist takes ~55%
of the view. Nothing is removed — everything gets an address. Plus one P0 bug fix (Escape).

---

## 0. P0 BUG — Escape is captured, Studio has no exit

**Found in build 4e1a5dd via GUI test.** Escape does not exit the Studio (verified in Play AND
Setup mode; Escape closes Settings fine, so delivery works).

Root cause: `App.js:427` — the language hotkey handler
(`if (e.code === "Escape" || ...) { e.preventDefault(); toggleLanguage(); }`) is registered at
mount and runs **before** the Studio exit listener (`App.js:647`), which then sees
`e.defaultPrevented === true` and returns. Side effect: every Escape press also silently toggles
EN/ES. The visible `← Scoreboard` buttons are dead markup (`display:none !important` since v4.75.3,
`index.css:4298`).

**Fix (one of):**
- Remove `"Escape"` from the language hotkey (keep Space + button) — Escape should mean "exit/back" app-wide; or
- In the language handler, skip Escape when `offCallWorkspace === "soundboard"`.

Then either un-hide `← Scoreboard` in Studio heads or delete the dead buttons — not both.

## 1. What the visual pass showed (900×600)

| Fact | Evidence |
|---|---|
| Checklist "Will callers hear it?" occupies ~270px (~55%) of studio height; gallery tiles start below the fold (~1 row half-visible, row 2+ invisible) | t1 |
| Setup opens on the 🖼️ app-background card before any clip — wrong priority for a greetings tool | t2 |
| Inside each action card, "Button cover image" zone sits ABOVE the audio clips — image before audio again | t3 |
| Storage/backup panel (5 buttons + orphan list) sits at the very bottom of a ~28-card scroll — undiscoverable when needed, visible when not | t4 |
| "Labels" checkbox is vestigial since v4.111.0 (thumb titles always visible) | t1 |
| Action cards are collapsed by default; expansion is one click — good, keep | t2 |

## 2. Subview architecture

`mode` state: `'play' | 'check' | 'record'` (was `'play' | 'settings'`). Persist last tab in
`localStorage['catint_sb_tab']`. Tab bar sits where the head is today: `▶ Play · 🧪 Check · 🎙 Record`,
plus `← Scoreboard` (restored) at the right. Enter → last-used tab (default Play).

### ▶ Play (default — the fire surface)
- Keeps: now-playing bar, safety notice, title + `CALL READY` pill, one-line missing nudge, gallery
  grid, empty-slot "Record in Setup" cards, editor overlay.
- Moves out: the whole preflight checklist, You/Caller volume sliders, Beep sink, More ▾ advanced
  drawer (Mic Monitor, route debug), Size slider + Labels checkbox → Size goes into a small `⋯`
  popover on the gallery head; Labels is deleted (vestigial).
- Fold math: gallery gains ~270px → ~3 tile rows visible at 900×600 instead of ~1.

### 🧪 Check (verify & arm — pre-call ritual)
- Keeps verbatim: "Will callers hear it?" 3-step checklist (quality / you hear / caller hears +
  CALL OK confirm), clip picker, Why/Fix/script explainers, sink route tip, Beep sink, volumes.
- Advanced drawer content lives here permanently (Mic Monitor + route debug) — no `More ▾` hiding.
- Tab badge mirrors armed state: `🧪 ✓` when CALL READY, `🧪 !` when something fails.

### 🎙 Record (setup — rare)
- Keeps: progress n/28 + bar, ↓ Next missing, Missing only, per-action collapse, slot pills,
  clip cards (Record/You/Caller/Edit, health/loudness/choppiness pills, teleprompter, upload,
  delete), storage backup panel.
- Reorders:
  - bg-app image card → bottom section "🖼️ Images & backup" together with storage panel (collapsed
    `<details>` by default).
  - Inside each action card: **Audio clips first**, cover-image zone second (or a 🖼️ chip on the
    card head opening the zone on demand).
  - `Save & Play` → renamed **`Done · Play ▶`** (it's navigation, not a save action).
- "Show legacy" filter chip hides `Legacy – *` actions until clicked (Setup + Play both).

## 3. No-functionality-loss checklist

| Today (where) | After (where) |
|---|---|
| Gallery tiles / empty slots / Record in Setup | Play |
| Now-playing bar, LIVE vs local, stop | Play (unchanged) |
| Size slider | Play → `⋯` popover |
| Labels checkbox | Deleted (superseded by v4.111.0 always-on titles) |
| 3-step preflight + CALL OK confirm | Check |
| Clip picker EN/ES + time-of-day | Check (unchanged) |
| Why / Fix / robot-heard / script explainer | Check (unchanged) |
| You / Caller volume sliders | Check (foot, unchanged) |
| Beep sink (quiet) | Check |
| Mic Monitor + volume | Check (advanced, always reachable) |
| Route debug | Check (advanced) |
| Progress n/28, Next missing, Missing only | Record head (unchanged) |
| Action cards, slot pills, collapse | Record (unchanged) |
| Clip cards: Record/You/Caller/Edit, pills, script, upload, delete, why/fix | Record (unchanged) |
| Cover image per action | Record — below audio instead of above |
| bg_app image | Record → bottom "Images & backup" |
| Storage panel: export/import/download/upload/scan, orphans | Record → bottom "Images & backup", collapsed `<details>` |
| Editor overlay (crop/re-record) | Global modal — unchanged, reachable from both Play & Record |
| `← Scoreboard` exit | Restored in tab bar (un-hide) + fixed Escape |
| Mic-mode banner + local-only firing | Play header (unchanged behavior) |

## 4. Sequencing proposal

- **v4.112.0 (small, low-risk):** Escape/language hotkey fix + un-hide or remove `← Scoreboard`;
  `Save & Play` → `Done · Play`; move bg card + storage panel to bottom of Setup; cover-image zone
  below audio; drop Labels checkbox. All are moves/renames — no new state.
- **v4.113.0 (structural):** 3-subview tab bar + advanced-drawer promotion + `⋯` popover + legacy
  filter. One PR, one push, tests after.

Both after the in-flight v4.110.0 (choppiness) lands, to avoid a version race.
