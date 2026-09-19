# WhatsApp greeting comparison — v4.108.3 investigation

**Status: unresolved.** Signal analysis only; this agent session cannot listen to audio. No playback or mixer changes performed.

## Supplied recordings

| File (repo root, ignored media) | Duration | Decoded format | Peak |
|---|---:|---|---:|
| WhatsApp Ptt 2026-09-12 at 7.05.06 PM half audio bad.ogg | 15.44 s | mono, 48 kHz | 0.741 |
| WhatsApp Ptt 2026-09-12 at 7.05.54 PM maybe too soon for the stars.ogg | 13.48 s | mono, 48 kHz | 0.654 |

- Both have sparse, quiet early sections, followed by much fuller signal around 7 s / 8 s respectively.
- In the 2–7 s interval, 81.6% / 61.4% of 10 ms frames fall below −60 dBFS; in 8–12.8 s, 15.0% / 11.2% do. Speech pauses and different content can affect this comparison.
- No decoded samples reach full scale. This does **not** exclude clipping or processing before WhatsApp encoding.
- No original greeting export is available in the workspace for a source-versus-output comparison.

## Route inspection and code review

- Live Standard mixer: physical Realtek mic and VAIO both feed B1; strips/B1 unmuted at 0 dB; reported rates 48 kHz. A1 still selects CABLE Input, so VAIO monitoring also enters the transcription cable.
- Settings' blank Default mic disables app passthrough. An explicitly selected virtual mic or enabled Mic Monitor can create additional paths; neither is established for these recordings.
- Direct Caller playback uses one decoded buffer and one 50 ms audio-clock ramp; no periodic mid-clip volume adjustment found.
- Separate ordinary-tile defect found: local preview ends can stop delayed caller playback; local volume ramp also waits for caller completion. Caller-only tests avoid that path. Do not attribute these recordings to this defect without knowing which button was used.

## What distinguishes the causes

1. Establish capture method: WhatsApp receiving B1 directly, or phone recording speakers? Establish whether the fuller second section is live speech or still the greeting.
2. Compare the same original greeting with a raw B1 recording (speech processing disabled), then WhatsApp. Clean raw B1 plus damaged WhatsApp isolates the receiving capture/processing path; damage already on raw B1 keeps the app/mixer path under investigation.
3. Echo/noise suppression is a candidate, not a diagnosis: receiving voice software can process captured playback. [WebRTC audio processing overview](https://webrtc.googlesource.com/src/+/refs/heads/main/modules/audio_processing/g3doc/audio_processing_module.md).

No additional app release proposed until the capture path is established.
