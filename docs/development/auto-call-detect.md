# Auto call detect — notes (2026-10-15, parked)

Status: **idea parked**, operator moved back to UI. Nothing built.

## Billing fact (corrects a wrong assumption)
Deepgram streaming bills **per minute of audio sent**, not per word. An open socket
fed audio costs money even in silence. The shift-ear warm pair (v4.172.0) is $0
only because it carries **no audio**. "Leave it open and transcribe everything" =
paying for every idle minute.

## Already shipped (check before building)
| piece | version | file |
|---|---|---|
| local VAD + warm socket → speech auto-starts the call | v4.92.0 | `src/utils/idleEar.js` |
| platform announcement phrases start the call | v4.98.0 | autopilot phrases, `useDeepgram.js` |
| farewell phrase → 120 s silence → cancellable 10 s end banner | v4.146.0 | `armAutopilotFarewell` |
| one warm pair all shift | v4.172.0 | `src/utils/shiftEar.js` |

**First question to answer:** is the existing detector failing, or switched off?

## Call END — stack signals, never trust one
1. **Digital silence:** a dropped call usually makes the tab audio exact zeros;
   a paused room still has noise floor. Local, $0, far more reliable than "no speech".
2. **Operator sign-off phrases:** the interpreter's own closing is consistent; callers' are not.
3. **Share ended:** tab audio track `ended` / `mute` events.
4. **Farewell + silence** (exists).

Rule: **2+ signals → the cancellable banner. Never end a call silently.**
