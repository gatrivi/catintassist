# Settings view (v4.161.0)

Where every setting lives, and how to add one without breaking the drawer.

## Shape

A right-side drawer, `min(420px, 96vw)`, opened by the gear in the header
(`SettingsButton.js` → `cat_show_settings`) or by any `cat_show_settings` event
carrying `{ panel: 'today' }`.

| piece | file | notes |
|---|---|---|
| registry (source of truth) | `src/utils/settingsRegistry.js` | ids, labels, hints, search words, groups, order |
| drawer chrome | `src/components/SettingsPanel.js` | renders nav from the registry, then the one section body |
| section bodies | same file, one `section === 'id'` block each | the panel id **is** the section id |

**Rule:** never add a tab by editing the JSX list. Add an entry to
`SETTINGS_PANELS` and its body block; the nav, search, pins and remembered
section come for free.

## Nav

- **Search** matches label + hint + keywords + id, AND across terms, ranked
  (label prefix > label > hint > keyword). While searching, groups collapse so
  the answer is not buried.
- **Groups:** Today · Speech · Output · App. A group with no panels drops out.
- **Pins:** ★ on any row, persisted in `catint_settings_pins_v1`.
  `DEFAULT_PINS = ['today']`. **A pinned panel is removed from its group**, so it
  is never listed twice. Two identical labels on one screen is how you get lost
  — that is why the panel is labelled "Call log" and the group "Today".
- **Remembered section:** `catint_settings_last_section_v1`. Opening the gear
  with no target returns there; an explicit `{ panel }` always wins.

## The three paste flows (all JSON/CSV, never plaintext)

| panel | what you paste | lands in |
|---|---|---|
| **Call log** (`today`) | company call rows — TSV, CSV, space-separated, or one field per line | minutes: scoreboard, timeline, month total |
| **Backup** (`data`) | app backup JSON | goals, greetings, settings, corrections |
| **Backup → Taught corrections** | corrections JSON | STT fixes + translation glossary (`catint_corrections_v1`) |

The call-log parser is pure: `parseCallLogText` → `groupCallsByDay` →
`diffDaysAgainstStored` → `mergeImportedDays`. See
`src/utils/callLogImport.js` and its test — the undo tests are the ones that
matter most.

**Today reads `stats.dailyMinutes`, not `dailyLog[today]`.** `dailyLog` is only
written at endDay/rollover, so mid-day it is empty while the scoreboard shows
84m. Reading it would make every preview say "0 → 23m" and hide the exact
mistake this tool exists to fix.

## Navigating panels (not sections)

A registry entry with `notSection: true` has an `action` instead of a body. The
only one is `goals` → `action: 'goals-view'`, which dispatches
`cat_open_goals_view` and closes the drawer. `App.js` handles it and opens the
goal wheel; it refuses during a call or a zombie call, and the drawer says
"off-call only" rather than closing on nothing.

`isSettingsPanel()` only accepts real sections, so a navigating panel can never
be remembered as the last section (that would reopen onto a blank body).

## Adding a setting

1. `SETTINGS_PANELS` entry: `id`, `group`, `label`, `hint`, `keywords`
   (the words you would actually type).
2. A `section === '<id>'` block in `SettingsPanel.js`.
3. A test in `SettingsPanel.test.js`. `setSession()` drives the session stub
   (in-call, signed in) — the old inline mock is gone.
4. If it changes behaviour on a call, say so in the release note.

## Still open

- Layout + a11y pass: the drawer scrolls as one block, so the nav scrolls out of
  view. 10px help text. No Esc, no focus trap, no arrow-key tab nav.
- Native `window.confirm` still used in the corrections panel.
- Goal configurator (`docs/goal-configurator.md`) has its own pending list.
