cats interpreter assistant app

Docs index: `docs/README.md`

## Handoff (outside agents)
Open tasks + file boundaries: [`docs/handoff/README.md`](docs/handoff/README.md). Read [`docs/handoff/00_global_rules.md`](docs/handoff/00_global_rules.md) once.

Suggested order: number protection → UI cleanup → medical terms → transcript corrections UI → scoreboard grid → auth/DB (later).

all new features must show the version number in the message aswell so i can easily verify if im running the app in the right version
after implementing feat, run tests, if satisfied, refactor, cleanup, and if confident, push to repo. do other things that you consider appropriate. do not push an app that crashes? didnt think i had to write that one out.
as a general rule express yourself in a tldr manner. as a rule im working (on call) while coding, so my brainspace is narrow tiny sliver.
try to keep this and other md files tldr, organized, and try very hard not to destroy or modify my instructions unless you are pretty sure it will not destroy ux.
[] completed tasks should be moved to a completed tasks section at the bottom of the file, and the section should be collapsible.
[] dont be too hasty in considering tasks complete, i have had several instances where you declared a task complete and it was not, and i had to go back and forth with you to get it right. 

CORE VALUES
- keep your messages brief, i can seldom dedicate more htan 10% attention to this.
- code as if for a toddler, simple, clear, organize, anottated, and in all manners try to economize tokens, it makes no sense to set a data center on fire to change a font on an invisible sub menu.
- this is a transcription app: 80% of viewport must be occupied by actual transcription and translation
- the remaining 20% is for keeping track, of this its key that i meet my monthly target, and for that i need to see how much i have to work per day, how much i am working per day, and how much time i have left,
-after implementing a feature, if satisfied, refactor, cleanup, run tests, and if confident, push to repo. do other things that you consider appropriate. do not push an app that crashes? didnt think i had to write that one out.
- app should look great in 900 by 600 pixels, and scale up from there.
- all version must have a version number clearly visible in the upper right corner to be sure im looking for new features in the version that actually has them xd.
- set and run tests after implementing features
- cleanup, refactor, document, commment
- dont push version that explode. hahaha.
- if features and ap works, then commit push.
- proposed changes should show precisely what changes, from what to whay. for example, a moment ago i requested adding percentages on the scoreboard, cited one metric as an example, and only the cited metric had a porcentage added, when it was clear it was all of them. so if i request a change i have to see what is actually going to be done before having to stop production to test something that should never have got so far.
[x] maximising workspace and minimizing things that eat workspace is the rule. translation and transcription should take 80% of screen, scoreboard 20%. (v4.21.0) 

CURRENT ISSUES
Phased product plan: [`docs/ROADMAP.md`](docs/ROADMAP.md) (Phase 0 STT sweep → Phase 1 UX → Phase 2+ later)

[x] Word count is now cumulative per turn: if user speaks more than 40 words and bubble splits, the count continues (v4.1.0)
[x] 1. Digit grouping for phone numbers: automatic back-to-back digit grouping for better legibility (v4.1.0)
[x] 2. keep track of how long ive been working wo breaks (v4.19.0)
[x] 3. collapse view, show tools, show toolbar and edit scoreboard items in same row (v4.19.0)
[x] 4. pinned reference: color coded, no banner, subtle icon (v4.19.0)

[ ] when speakers speaks too long, message is split, this is good as it makes for easier reading, but has two problems
[x] sometimes it seems that on message split the translation is garbled — v4.57 cleared stale text; v4.59.0 immediate re-translate on split (still watch in prod)
[x] when app window is refreshed during active call — v4.20 zombie + v4.59.0 I/O hint in re-attach banner (still watch in prod)

MAINVIEW (where transcription and translation happens)
[x] space should be used as effectively as possible (v4.21.0: Call Mode auto-minimizes header to ~32px during calls; v4.22.0: Call Focus Mode auto-hides sidebars during calls for 100% transcription width)
  [] do not waste v space w things like spa and eng. use color coding to do that.
[x] any time 9 or 10 digits are said back to back, group them (v4.15.0/v4.19.0)

SCOREBOARD GUIDELINES
[x] keep track of how long ive been working wo breaks. 
[x] Subtract break time from total of 90 per day.
[x] keep track of how late i logged in compared to log in time of 9am
[x] tell me how late i should stay after my shift end of 18hs to compensate (v4.19.0)
[] Add little outlines and toggleable labels to every element in the scoreboard — help toggle in condensed toolbar (v4.59.0); full grid rearrange still deferred

TRANSLATION GUIDELINES
[] a poor translation is better than no translation
[] dont burn through free tiers. you say you run 54 translation engines at the same time but all i see is "bueno" and that, 54 seconds too late.
[] if the user speaks a lot, break up message and transalte by parts. i just had a 60 word message, the transcription was split in two and when that happened the transpation for the second part came through but the first part had "bueno". that didnt work.
[] if you accidentally edit a phone number out while i am reading it i am going to lose my job




SOUNDSCAPE INTERPRETER
[] when we press connect and call starts a sound like a purse opening is played. 
[] every minute the sound of earning one coin is played
[] every succeeding minute the sound of earning another coin in a proportionally richer sound
[] on complete call a sound like a proportional stack of coins crashing into a purse is played

good friday
[] soundboard doesnt work
  [] patients hear it breaking up really bad or not at all
  [] there should be a simple way to check if a soundboard greeting sucks. for example, if i send it to deepgram, it would fail to transcribe, and probably flag it as poor quality audio. 
  [] soundboard greetings should have a health bar, from unacceptable to peaches with intermediate steps. 
  [] again, there must be simple ways to check the "legibility" of speech soundboard greetings. 
  [] i have used voicemod prerecorded greetings for a while with zero problems. when i have problems with voicemod greetings i can find out at once because when i myself hear them they suck. but here i hear them they sound fine but when i play them to the patient they very vocally express that they suck.

[x] expanded scoreboard de-clutter (v4.59.0): Show tools → notes+bg; inline utility row; hide dup STOP/mic during call; pct on all 12 grid cells
  [] soundboard still doesnt work. when i press a prerecorded greeting my patients scream in pain.


CURRENT INBOX



<details>
<summary><b>Completed Tasks</b></summary>

- [x] translation trigger: 10+ words and punctuation (dot, comma, ?) force request (v3.9.1)
- [x] condensed view should contain (mins/target, $/total for day/month)
- [x] daily and monthly min amts can be edited from condensed view (Click pills)
- [x] progress bar says literal hours left and est workable hours left
- [x] msgs can be pinned so they dont scroll away
- [x] avail starts running at 9am and stops at 00hs
- [x] popover that shows up if you highlight a word and wait a bit for dictionary
- [x] all numbers should be highlighted, click to auto copy
- [x] all numbers should be written in numbers, not string (1-90, tens, teens)
- [x] translation: incremental segment-based triggers (v4.1.0)
- [x] transcription: 2.0s silence threshold / 80 word overflow (v4.1.0)
- [x] word tracking: cumulative turn word count (v4.1.0)
- [x] formatting: automatic grouping of 9-10 digit sequences (v4.1.0)
- [x] intermediary goals (12 step goals): Level 1 (Floor), Level 2 (Growth), Level 3 (Legend)
- [x] timeline: painting orange in the progress bar during non-call time (v4.2.1)
- [x] stability: auto-reconnect for Deepgram WebSockets and fixed timeline race conditions (v4.2.2)
- [x] UI: improved contrast for 'In Call' segments with white glow effect (v4.2.2)
- [x] health: Smart Status Dot and 'Zap' button for stale connections (v4.2.3)
- [x] alerts: 'Interpretation Stuck' warning banner in SilenceGuardian (v4.2.3)
- [x] HUD: real-time silence counter that resets on speech (v4.2.4)
- [x] HUD: universal idle counter that tracks time off-call regardless of state (v4.2.5)
- [x] HUD: immediate popovers for timeline segments showing start/end times (v4.2.6)
- [x] media stream: tab connection is preserved across calls to prevent redundant permission requests (v4.12.0)
- [x] Scoreboard refactor: implemented 12 core metrics in a high-density 4x3 terminal grid layout (v4.13.0)
- [x] data protection: phone/SSN/address sequences are guarded from overlap removal; EN+ES number words convert to digits; 10-digit→XXX-XXX-XXXX, 9-digit→XXX-XX-XXXX (v4.15.0)
- [x] scramble text: prefix-aware animation — only new suffix scrambles on append; softer number-only charset; stable keys prevent remounts (v4.15.1)
- [x] daily bar: shifted timeline to 9am-18hs focus; overtime shown as extended tail or micro under-bar with toggle (v4.17.0)
- [x] rolling numbers: fixed unbounded offset growth and added stable place-value keys for numeric values (v4.17.0)
- [x] data protection: fixed critical bug where numbers disappeared during live calls; hardened number sequences against deduplication and hallucination pruning (v4.18.0)
- [x] UI optimization: condensed header buttons moved to single row; added 'minutes since last break' counter; refined pinned message UI; improved money rain burst (v4.19.0)
- [x] Zombie Call Recovery: added yellow 'Re-attach' indicator and prominent warning banner to prevent session loss on refresh (v4.20.0)
- [x] Translation Stability: implemented 'sticky' language pairs and fixed feedback loops to prevent translations from being destroyed during splits (v4.20.0)
- [x] Call Mode: auto-minimizes header to a 32px micro-bar during active calls, giving transcription ~95% of viewport (v4.21.0)
- [x] Micro-Break Nudge: top mic-bar turns orange at 90m without break, red at 110m — visual cue where your eyes already are (v4.21.0)
- [x] Smart Bubble Compression: transcript bubbles >50 words auto-collapse to ~5 lines with one-click expand, reducing reading fatigue (v4.21.0)
- [x] Call Focus Mode: auto-hides notes/tools sidebars during calls; toggle via 🎯 button in header (v4.22.0)
- [x] Post-Call Summary: on call end, extracts numbers and dollar amounts from the transcript, shows dismissible toast (v4.22.0)
- [x] Enhanced Filler Filter: strips um/uh/like/you know/bueno/pues from sentence starts, reducing reading fatigue (v4.22.0)
- [x] v4.27.0: transcript white / translation gray; bubble splits on `. ! ?`; quick notes during call focus; sticky connect/stop; persistent pin section; EN-only number words (fixes ten/tenía)
- [x] Shift attach split: auto-attach tab at 9am; CONNECT vs CALL START; off-call status bar; idle pane tips/checklist/metrics rotation; C/M hotkeys (v4.48.3)
- [x] v4.57.0: version pill; Zap re-enabled; ErrorBoundary; translation split stale-clear; habit dock hidden by default
- [x] v4.58.0: soundboard exit trap; I/O strip + audio self-test; goal wheel pill; wellbeing dock rebrand; onboarding dismiss
- [x] v4.59.0: Show tools wires notes+bg_app; expanded scoreboard de-clutter; pct on all 12 grid metrics; help in condensed toolbar; split translate immediate; zombie banner I/O hint
- [x] v4.60.0: docs/ROADMAP.md; persistent 🎯 goal wheel + portal; scoreboard presets (Min/Std/Full) + metric toggles; mic meter in I/O strip; bundled default bg fallback
</details>
