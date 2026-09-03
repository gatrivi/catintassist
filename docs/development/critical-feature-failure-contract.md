# Critical feature failure contract

Applies to call-critical features: STT, call audio route, translation, and session controls.

1. Prefer a working fallback that preserves the call and never silently changes the audio source.
2. If recovery needs operator action, show exactly what failed, where to click, and the next one-step action.
3. Do not attempt a known-doomed step first. Example: a locked saved Deepgram key opens **Settings -> Deepgram -> Unlock** before audio capture.
4. Keep the recovery reachable during a call and preserve the existing captions/stream until the replacement is verified.
5. Add a focused regression test and a code comment at the recovery gate before changing it.

The short operator rule: **say what broke, say how to fix it, and put the fix one click away.**
