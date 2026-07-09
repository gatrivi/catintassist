# Call audio without tab share — no single point of failure

**Premise to kill:** "VB-Cable means call audio goes THROUGH the app."
It doesn't have to. Windows can monitor the cable at OS level — the app only *reads* it.
If app/browser/Deepgram all crash, you still hear the patient.

## Setup (one time, ~5 min)

1. **Platform output → CABLE Input**
   Windows Settings → System → Sound → Volume mixer → find the platform app/browser → Output: `CABLE Input (VB-Audio)`.
2. **OS-level monitoring (the SPOF killer)**
   Sound Control Panel → Recording tab → `CABLE Output` → Properties → **Listen** →
   check *Listen to this device* → playback: your headset.
   This runs inside Windows audio engine. No app in the path.
3. **App reads the cable**
   CatIntAssist Settings → audio source → **Virtual cable** → device `CABLE Output`.
   (Already supported — `AUDIO_SOURCE_MODE_VIRTUAL_CABLE` in `useAudioSource.js`.)
4. **Fallback stays:** tab share still works from Connect if the cable acts up mid-shift.

## Failure modes

| Failure | Tab share today | Cable + Listen |
|---|---|---|
| App crashes | audio OK, STT dead | audio OK, STT dead |
| Chrome (app tab) crashes | audio OK, STT dead | audio OK, STT dead |
| VB-Cable driver dies | n/a | audio dead — rare; reboot fixes. Keep tab share as fallback |

## Notes

- Listen adds ~30–80 ms to what you hear. Irrelevant for interpreting.
- Video track in tab share was never needed; cable mode drops it entirely (less CPU, no share picker, no "stop sharing" bar accidents).
- **Later unlock:** second cable (CABLE-B): app soundboard → platform *mic* input = greetings injected directly, no Voicemod, no acoustic loopback — likely fixes "patients hear greetings breaking up".
