# 🔈 Soundboard: Pre-recorded Greetings
Updated: 2026-04-05 (v3.6.2)

### AUDIO HEALTH (AI AUDIT)
The app uses Deepgram to automatically analyze the "legibility" of your recorded greetings.
- [x] **Health Indicators**: Each button now shows a micro-health bar (RED ⛔ to GREEN 🍑).
- [x] **AI Audit**: On upload/record, the audio is sent to Deepgram. If the AI confidently transcribes it, the status is **PEACHES**. If it fails, it's flagged as **UNACCEPTABLE**.
- [x] **Audit Visibility**: Health bars are visible in both **Settings** and **Play Mode** for quick status checks.

### PLAYBACK & SAFETY
- [x] **Anti-Scream Ramp**: The audio engine now ramps up volume over 50ms rather than hitting the channel at 100% instantly, preventing pops and "patient screams."
- [x] **Test Mode**: Activating 🧪 prevents playback to the Virtual Mic (Caller), allowing you to hear/verify locally.
- [x] **Mic Monitor**: Enable **Hear Myself** (👂) to verify your physical recording path before committing to a long greeting.

### KNOWN ISSUES
- [ ] Users still report "crackles." This might be related to browser buffer overhead during high STT load.