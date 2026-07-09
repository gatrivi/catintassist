/** Shared off-call status (header) vs guidance (idle pane). */

import { isRememberExpired, needsUserSuppliedDeepgramKey } from './deepgramRuntimeKey';
import { canUseTabCapture, isLikelyEmbeddedPreviewBrowser } from './audioSourceManager';

export const IDLE_TIP_LEVEL_KEY = 'catint_idle_tip_level_v1';
export const IDLE_TIP_SNOOZE_UNTIL_KEY = 'catint_idle_tip_snoozed_until_v1';

export const OFF_CALL_ADVICE = [
  'Press C or CONNECT to attach, then press again to start interpreting.',
  'Press M or use the 🎤 mic button (header right) if tab audio is unavailable.',
  'Double-tap CONNECT to re-open the browser tab picker (Chrome/Edge).',
  'Pin key details so numbers stay visible while you wait.',
  'Settings → Language to change transcription pair (default EN↔ES).',
  'Space / Alt+Space force left/right STT lane (30s) — pair in Settings → Language.',
  'Open Help (?) for the bilingual guided tour.',
];

export const IDLE_TIPS = [
  'At 9am the app auto-attaches your interpreting tab when Auto-attach is on.',
  'Press C or CONNECT to attach; press again when the patient connects.',
  'Press M or the 🎤 mic button to use your microphone instead of tab audio.',
  'Double-tap CONNECT to re-open the browser tab picker (Chrome/Edge).',
  'Use Space/Alt+Space to toggle EN/ES detection while you wait.',
  'Pin key details so voicemail numbers stay visible.',
  'Soundboard Studio — record greetings off-call only.',
];

export const IDLE_CHECKLIST = [
  'CONNECT tab (or 🎤 mic) · press Connect again to start interpreting · STOP when done',
  'Deepgram key in Settings (gear) if STT fails',
  'VB-Cable output routes greetings to the patient',
];

export const readIdleTipPrefs = () => {
  try {
    const level = localStorage.getItem(IDLE_TIP_LEVEL_KEY) || 'normal';
    const snoozedUntil = Number(localStorage.getItem(IDLE_TIP_SNOOZE_UNTIL_KEY) || '0');
    return { level, snoozedUntil };
  } catch {
    return { level: 'normal', snoozedUntil: 0 };
  }
};

export const isIdleTipsMuted = (prefs = readIdleTipPrefs()) =>
  prefs.level === 'less' || prefs.snoozedUntil > Date.now();

export const pickRotatingAdvice = (now = Date.now()) =>
  OFF_CALL_ADVICE[Math.floor(now / 12000) % OFF_CALL_ADVICE.length];

/** One-line factual status for header / scoreboard cue. */
export const buildOffCallStatusLabel = ({
  settingsOpen = false,
  vaultNeedsDecrypt = false,
  apiKeyMissingNoVault = false,
  vaultStatus = 'idle',
  connectionState = 'disconnected',
  connectionMessage = '',
  apiKeyMissing = needsUserSuppliedDeepgramKey(),
  isBreakActive = false,
  isZombieCall = false,
  audioAttached = false,
  tabStreamReady = false,
  micTestMode = false,
}) => {
  if (settingsOpen && vaultNeedsDecrypt) return 'Unlock Deepgram';
  if (settingsOpen && apiKeyMissingNoVault) return 'Add Deepgram key';
  if (vaultStatus === 'unlocking') return 'Unlocking key…';
  if (connectionState === 'connecting') return connectionMessage || 'Connecting…';
  if (connectionState === 'error') return 'Deepgram error';
  if (isRememberExpired() && apiKeyMissing) return 'Key session expired';
  if (vaultNeedsDecrypt) return 'Deepgram locked';
  if (apiKeyMissingNoVault) return 'No Deepgram key';
  if (isBreakActive) return 'On break';
  if (!micTestMode && !audioAttached && !canUseTabCapture()) {
    return isLikelyEmbeddedPreviewBrowser() ? 'Tab share unavailable' : 'Tab share unavailable';
  }
  if (isZombieCall) return 'Call active — re-attach';
  if (audioAttached) return micTestMode ? 'Mic connected' : 'Tab connected';
  const h = new Date().getHours();
  if (!micTestMode && !tabStreamReady && h >= 9 && h < 18) return 'Tab disconnected';
  return 'Ready';
};

/** Guidance copy for the off-call interpret idle pane (not the header). */
export const buildOffCallIdleDetail = (ctx) => {
  const {
    settingsOpen = false,
    vaultNeedsDecrypt = false,
    apiKeyMissingNoVault = false,
    vaultStatus = 'idle',
    connectionState = 'disconnected',
    connectionMessage = '',
    apiKeyMissing = needsUserSuppliedDeepgramKey(),
    isBreakActive = false,
    isZombieCall = false,
    audioAttached = false,
    tabStreamReady = false,
    micTestMode = false,
    slackText = '',
  } = ctx;

  const lines = [];
  let showRotatingTip = false;
  let showChecklist = false;
  let showDiagnostics = connectionState === 'connecting' || connectionState === 'error';

  if (settingsOpen && vaultNeedsDecrypt) {
    lines.push('Unlock Deepgram — enter password in Settings (gear, top-right).');
  } else if (settingsOpen && apiKeyMissingNoVault) {
    lines.push('Paste your Deepgram key in Settings (gear, top-right).');
  } else if (vaultStatus === 'unlocking') {
    lines.push('Unlocking encrypted key vault…');
  } else if (connectionState === 'connecting') {
    lines.push(connectionMessage || 'Connecting to Deepgram…');
    lines.push('When audio is attached, press the green Connect button again to start interpreting.');
  } else if (connectionState === 'error') {
    lines.push(
      'Deepgram is not working (STT engine). Press ⚡ Zap, then check Settings key, WebSocket, and tab/mic permissions.'
    );
    showDiagnostics = true;
  } else if (isRememberExpired() && apiKeyMissing) {
    lines.push('Password session expired — open Settings (gear, top-right) and unlock again.');
  } else if (vaultNeedsDecrypt) {
    lines.push('Deepgram key is locked — open Settings or press Decrypt on Connect.');
  } else if (apiKeyMissingNoVault) {
    lines.push('No Deepgram key yet — open Settings (gear, top-right) or tap the key icon.');
  } else if (isBreakActive) {
    lines.push('On break — press the green Connect button when you return.');
  } else if (!micTestMode && !audioAttached && !canUseTabCapture()) {
    lines.push(
      isLikelyEmbeddedPreviewBrowser()
        ? 'Cursor preview cannot share tabs — open in Chrome/Edge, or turn on 🎤 mic mode (header right).'
        : 'This browser cannot share tabs — use Chrome/Edge, or turn on 🎤 mic mode (header right).'
    );
    showChecklist = true;
  } else if (isZombieCall) {
    lines.push(`Call still active — press Re-attach (timer saved). ${slackText}`.trim());
    lines.push('Transcript and timer are preserved — no need to Stop.');
  } else if (audioAttached) {
    lines.push(
      micTestMode
        ? 'Microphone connected — press the green Connect button to start interpreting.'
        : 'Tab connected — press the green Connect button to start interpreting.'
    );
  } else {
    const h = new Date().getHours();
    if (!micTestMode && !isZombieCall && !tabStreamReady && h >= 9 && h < 18) {
      lines.push('Tab disconnected during work hours — reconnect now to avoid missing the first lines.');
    }
    lines.push(
      micTestMode
        ? 'Mic mode ON — press the green Connect button (top-left) to connect the microphone.'
        : 'Tab mode — press the green Connect button (top-left) to share the interpreter tab (Chrome/Edge).'
    );
    lines.push('Then press Connect again to start interpreting.');
    showRotatingTip = !isIdleTipsMuted();
    showChecklist = true;
  }

  return { lines, showRotatingTip, showChecklist, showDiagnostics };
};
