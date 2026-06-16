# Onboarding Quickstart (v4.48.2)

## What this app expects
- Deepgram STT (EN + ES)
- Translation fallback(s)
- Virtual mic / audio routing (tab or selected sink)

## Local dev
1. `npm install`
2. Configure `.env` (Deepgram + translation keys)
3. `npm start` (Fast Refresh / HMR)
4. Restart after `.env` changes

## Controls you must recognize
1. `Connect`
   - Press to connect to the interpretation service.
   - (Some versions) one click starts interpreting from your mic.
   - Double click connects to another tab running the interpreting platform (Google Chrome preferred).
2. `Hold`
   - Starts the 15 minute hold policy timer.
3. `Refresh interpretation stream`
4. `Start break timer`

## Mic Test (v4.48.2)
🎤 next to `Connect`
- ON = transcribe from your microphone (no tab picker)
- OFF = normal tab audio capture

## Sanity checks (fast)
1. `Connect`
2. Speak EN
   - EN transcription lane should be white
   - ES translation lane should be gray/italic
3. Speak ES
   - lanes swap by detected speaker language

