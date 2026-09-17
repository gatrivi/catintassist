/**
 * Caller-monitor preference — caller-bound audio (greetings, TTS) plays to the
 * patient path ONLY by default. A parallel local copy used to play on the
 * interpreter's speakers at the same time; combined with a Voicemeeter A1 loop
 * back into the cable it sounded like every greeting twice (v4.128.0).
 * Opt-in: check "Monitor" on the on-call strip to also hear a local copy.
 */
const KEY = 'CATINT_CALLER_MONITOR';

export function readCallerMonitor() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeCallerMonitor(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch (_) {}
}
