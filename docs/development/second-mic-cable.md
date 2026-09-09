# Second cable for the microphone

Status (2026-09-06): Voicemeeter driver installed and reports OK after restart.
Mic routing applied and read back: HS-220U on hardware strip 1, B1 on,
A1 off, mic/B1 unmuted; other strips excluded from B1. Windows defaults unchanged.
Call-platform input selection and caller-side voice verification remain pending.
Greetings are deliberately excluded from B1 until app forwarding is checked.

Reusable local setup: `scripts/setup-voicemeeter-mic.ps1` (inspect by default;
`-Apply` saves an XML backup in TEMP before configuring the mic).
Backup from this setup: `%TEMP%/catint-voicemeeter-before-20260906-164808.xml`.
Restore through Voicemeeter Menu → Load Settings.

Verified endpoints: physical mic `Microphone (HS-220U)`, headset
`Speakers (HS-220U)`, outgoing playback `Voicemeeter Input`, call microphone
`Voicemeeter Out B1 (VB-Audio Voicemeeter VAIO)`. This installation uses
the newer **Out B1** name instead of **Voicemeeter Output** below.

Windows reports the original VB-Audio Virtual Cable and Voicemod installed,
but no Cable A/B. No A/B installer found in Downloads.

### Free route (recommended)

Install [Voicemeeter Standard](https://vb-audio.com/Voicemeeter/). VB-Audio
labels it donationware/evaluation: it provides one virtual input and one
virtual output, which is enough for the mic path. Run the installer as
administrator and reboot when it asks. A payment is not required to test it;
the About dialog may later show a donation/license prompt.

In Voicemeeter: choose the physical microphone as Hardware Input 1, enable
the `B` bus for that strip, and leave patient audio off that strip. Set the
call platform microphone to `Voicemeeter Output (VB-Audio Voicemeeter VAIO)`.
CatIntAssist can select `Voicemeeter Input` as its outgoing sink for greetings.

### Paid alternative

The [VB-CABLE A+B package](https://vb-audio.com/Cable/VirtualCables.htm) adds
dedicated Cable A/B drivers, without requiring a mixer application.

## Intended routing

| Purpose | Route |
|---|---|
| Patient audio (keep existing) | Call output → CABLE Input → CABLE Output |
| Hearing patient (keep existing) | CABLE Output → Windows Listen → headset |
| Transcription (keep existing) | CatIntAssist reads CABLE Output |
| Your voice | Physical microphone → Voicemeeter Hardware Input 1 |
| Call microphone | Voicemeeter Output (B bus) |
| Greetings, after verification | CatIntAssist → Voicemeeter Input → B bus |

Input is the cable's playback endpoint; Output is its recording endpoint.
Never send patient audio into Cable B: that would return it to the caller.

## Voice forwarding

Prefer Voicemeeter’s hardware input and `B` bus. Verify latency and sound
quality off-call. Do not also enable Windows Listen or app mic forwarding for
the same microphone: two paths can double the voice.
Rollback: set the call platform microphone back to the physical mic and mute
the Voicemeeter B bus. Leave the existing patient cable untouched.

## App work before enabling greetings

The existing app has mic forwarding, but `audioSourceManager.js` recognizes
plain CABLE Input and currently prefers it. `AudioSettingsContext.js` can
automatically replace an unrecognized selected sink with that original cable.
Selecting Cable B alone is therefore insufficient.

- [ ] Accept Cable A/B playback labels and preserve explicit device selection.
- [ ] Keep STT on the original cable; select Cable B separately for outgoing audio.
- [ ] Prevent outgoing audio from automatically falling back to the patient cable.
- [ ] Allow Windows-forwarded mic use without duplicate app forwarding.
- [ ] Test selection persistence, missing Cable B, and original STT selection.
- [ ] Verify a recording from Cable-B Output: voice, greeting, then voice again;
      no patient playback, echo, clipping, or dropouts. Recheck after app reload.
- [ ] Run app tests/build and bump visible version when shipping app changes.

Existing uncommitted audio changes belong to ongoing work; preserve them.
No driver installation, end-to-end verification, or app release completed yet.
