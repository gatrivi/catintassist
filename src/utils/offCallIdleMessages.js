/** Shared off-call status (header) vs guidance (idle pane). */

import { isRememberExpired, needsUserSuppliedDeepgramKey } from './deepgramRuntimeKey';
import {
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  canUseTabCapture,
  isLikelyEmbeddedPreviewBrowser,
} from './audioSourceManager';

export const IDLE_TIP_LEVEL_KEY = 'catint_idle_tip_level_v1';
export const IDLE_TIP_SNOOZE_UNTIL_KEY = 'catint_idle_tip_snoozed_until_v1';

/** mic wins (phone/local); else VB; else tab. */
export const resolveIdleAudioMode = ({
  micTestMode = false,
  audioSourceMode = 'tab',
} = {}) => {
  if (micTestMode) return 'mic';
  if (audioSourceMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE) return 'virtualCable';
  return 'tab';
};

const TIPS_COMMON = [
  'Pin key details so numbers stay visible while you wait.',
  'Settings → Language to change transcription pair (default EN↔ES).',
  'Space / Alt+Space force left/right STT lane (30s) — pair in Settings → Language.',
  'Open Help (?) for the bilingual guided tour.',
  'Soundboard Studio — record greetings off-call only.',
];

const TIPS_TAB = [
  'Press C or CONNECT to attach and start interpreting.',
  'Press M or tap 🎤 in the I/O strip (🔖 · 🎧 · 🎤) if tab audio is unavailable.',
  'Double-tap CONNECT to re-open the browser tab picker (Chrome/Edge).',
  'At 9am the app auto-attaches your interpreting tab when Auto-attach is on.',
  'I/O strip: tap 🎧 when STT should read CABLE Output.',
  ...TIPS_COMMON,
];

const TIPS_VB = [
  'VB-Cable mode — CONNECT attaches CABLE Output (no tab picker).',
  'I/O strip → 🔖 if cable fails; 🎤 for phone/local test.',
  'Soundboard greetings still route via VB-Cable Input to the patient.',
  'Double-tap CONNECT to pick a different CABLE Output device.',
  ...TIPS_COMMON,
];

const TIPS_MIC = [
  'Mic mode — CONNECT uses your microphone (no tab picker).',
  'Soundboard/TTS play on local speakers only in mic mode.',
  'Turn 🎤 off for desktop tab or VB-Cable production calls.',
  'Double-tap CONNECT to pick a different microphone.',
  ...TIPS_COMMON,
];

const CHECKLIST_TAB = [
  'CONNECT tab (or 🎤 mic / VB Cable) · one press starts · STOP when done',
  'Deepgram key in Settings (gear) if STT fails',
  'VB-Cable Input routes greetings to the patient (desktop)',
];

const CHECKLIST_VB = [
  'CONNECT VB-Cable · CABLE Output → STT · no tab picker',
  'Deepgram key in Settings (gear) if STT fails',
  'VB-Cable Input routes greetings to the patient',
];

const CHECKLIST_MIC = [
  'CONNECT mic · local speakers for soundboard/TTS · STOP when done',
  'Deepgram key in Settings (gear) if STT fails',
  'Turn 🎤 off before desktop production (tab or VB)',
];

/** @deprecated prefer tipsForMode — kept for callers that ignore mode */
export const OFF_CALL_ADVICE = TIPS_TAB;
/** @deprecated prefer tipsForMode */
export const IDLE_TIPS = TIPS_TAB;
/** @deprecated prefer checklistForMode */
export const IDLE_CHECKLIST = CHECKLIST_TAB;

export const tipsForMode = (mode = 'tab') => {
  if (mode === 'mic') return TIPS_MIC;
  if (mode === 'virtualCable') return TIPS_VB;
  return TIPS_TAB;
};

export const checklistForMode = (mode = 'tab') => {
  if (mode === 'mic') return CHECKLIST_MIC;
  if (mode === 'virtualCable') return CHECKLIST_VB;
  return CHECKLIST_TAB;
};

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

export const pickRotatingAdvice = (now = Date.now(), mode = 'tab') => {
  const list = tipsForMode(mode);
  return list[Math.floor(now / 12000) % list.length];
};

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
  cableStreamReady = false,
  micTestMode = false,
  audioSourceMode = 'tab',
}) => {
  const mode = resolveIdleAudioMode({ micTestMode, audioSourceMode });
  if (settingsOpen && vaultNeedsDecrypt) return 'Unlock Deepgram';
  if (settingsOpen && apiKeyMissingNoVault) return 'Add Deepgram key';
  if (vaultStatus === 'unlocking') return 'Unlocking key…';
  if (connectionState === 'connecting') return connectionMessage || 'Connecting…';
  // Prefer real failure text — "Deepgram error" hid mic-denied on mobile.
  if (connectionState === 'error') {
    const msg = (connectionMessage || '').trim();
    if (msg) return msg.length > 48 ? `${msg.slice(0, 45)}…` : msg;
    return 'Deepgram error';
  }
  if (connectionState === 'disconnected' && connectionMessage) return connectionMessage;
  if (isRememberExpired() && apiKeyMissing) return 'Key session expired';
  if (vaultNeedsDecrypt) return 'Deepgram locked';
  if (apiKeyMissingNoVault) return 'No Deepgram key';
  if (isBreakActive) return 'On break';
  if (mode === 'tab' && !audioAttached && !canUseTabCapture()) {
    return 'Tab share unavailable';
  }
  if (isZombieCall) return 'Call active — re-attach';
  if (audioAttached) {
    if (mode === 'mic') return 'Mic connected';
    if (mode === 'virtualCable') return 'VB connected';
    return 'Tab connected';
  }
  const h = new Date().getHours();
  if (h >= 9 && h < 18) {
    if (mode === 'tab' && !tabStreamReady) return 'Tab disconnected';
    if (mode === 'virtualCable' && !cableStreamReady) return 'VB disconnected';
  }
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
    cableStreamReady = false,
    micTestMode = false,
    audioSourceMode = 'tab',
    slackText = '',
  } = ctx;

  const mode = resolveIdleAudioMode({ micTestMode, audioSourceMode });
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
    lines.push('Starting interpretation…');
  } else if (connectionState === 'error') {
    const detail = (connectionMessage || '').trim();
    lines.push(
      detail ||
        (mode === 'virtualCable'
          ? 'Deepgram is not working (STT). Press ⚡ Zap, then check Settings key and VB-Cable Output.'
          : mode === 'mic'
            ? 'Deepgram is not working (STT). Press ⚡ Zap, then check Settings key and mic permissions.'
            : 'Deepgram is not working (STT engine). Press ⚡ Zap, then check Settings key, WebSocket, and tab/mic permissions.')
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
  } else if (mode === 'tab' && !audioAttached && !canUseTabCapture()) {
    lines.push(
      isLikelyEmbeddedPreviewBrowser()
        ? 'Cursor preview cannot share tabs — open in Chrome/Edge, or use 🎤 mic / VB Cable (I/O strip).'
        : 'This browser cannot share tabs — use Chrome/Edge, or use 🎤 mic / VB Cable (I/O strip).'
    );
    showChecklist = true;
  } else if (isZombieCall) {
    lines.push(`Call still active — press Re-attach (timer saved). ${slackText}`.trim());
    lines.push('Transcript and timer are preserved — no need to Stop.');
  } else if (audioAttached) {
    lines.push(
      mode === 'mic'
        ? 'Microphone connected — press the green Connect button for the next call.'
        : mode === 'virtualCable'
          ? 'VB-Cable connected — press the green Connect button for the next call.'
          : 'Tab connected — press the green Connect button for the next call.'
    );
  } else {
    const h = new Date().getHours();
    if (!isZombieCall && h >= 9 && h < 18) {
      if (mode === 'tab' && !tabStreamReady) {
        lines.push('Tab disconnected during work hours — reconnect now to avoid missing the first lines.');
      } else if (mode === 'virtualCable' && !cableStreamReady) {
        lines.push('VB-Cable disconnected during work hours — reconnect now to avoid missing the first lines.');
      }
    }
    lines.push(
      mode === 'mic'
        ? 'Mic mode ON — press the green Connect button (top-left) to connect and start.'
        : mode === 'virtualCable'
          ? 'VB-Cable mode — press the green Connect button (top-left) to attach CABLE Output and start.'
          : 'Tab mode — press the green Connect button (top-left) to share tab audio and start.'
    );
    showRotatingTip = !isIdleTipsMuted();
    showChecklist = true;
  }

  return { lines, showRotatingTip, showChecklist, showDiagnostics, mode };
};
