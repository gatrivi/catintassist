// Client-mic verify (v4.97.0) — pure helpers, unit-tested.
//
// Why this exists: the interpreter's real risk is "client cannot hear me"
// (hang-up = fired), and the old habit — testing the mic in ANOTHER tab —
// lies: a fresh tab grabs a fresh stream on the current default device,
// while the platform tab follows EDGE'S default mic. This module proves,
// from this tab: which mic Edge resolves as default, whether YOUR VOICE
// actually arrives on the pinned client mic (live RMS probe), and whether
// the pinned pick disagrees with Edge's default. All local, zero API.

/** localStorage: pinned client-mic LABEL (labels survive reboot; origin-scoped deviceIds do not — v4.87.0 lesson). */
export const CLIENT_MIC_KEY = 'CATINTASSIST_CLIENT_MIC_LABEL';
/** localStorage: last verify verdict { tone, label, at }. */
export const MIC_VERIFY_LAST_KEY = 'CATINTASSIST_MIC_VERIFY_LAST';

/** Speak-now probe window (ms) and the loudness bar (same as idle ear). */
export const MIC_PROBE_MS = 5000;
export const MIC_RMS_THRESHOLD = 0.02;
/** Safety cap on simultaneous probe streams. */
export const MIC_PROBE_CAP = 6;

// ---------- storage (tiny, guarded) ----------

export const readPinnedClientMicLabel = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  try { return (storage?.getItem(CLIENT_MIC_KEY) || '').trim(); } catch (_) { return ''; }
};

export const writePinnedClientMicLabel = (label, storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  try { storage?.setItem(CLIENT_MIC_KEY, (label || '').trim()); } catch (_) {}
};

export const readLastVerify = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  try { return JSON.parse(storage?.getItem(MIC_VERIFY_LAST_KEY) || 'null'); } catch (_) { return null; }
};

export const writeLastVerify = (verdict, storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  try { storage?.setItem(MIC_VERIFY_LAST_KEY, JSON.stringify(verdict)); } catch (_) {}
};

// ---------- device helpers ----------

/** "Default - Microphone (X)" / "Communications - X" → "Microphone (X)". */
export const stripDefaultPrefix = (label = '') =>
  (label || '').replace(/^(default|communications)\s*-\s*/i, '').trim();

/**
 * The device Edge's `default` input RESOLVES to — this is what the platform
 * tab grabs when it uses the browser default. Needs mic permission for labels.
 */
export const findEdgeDefaultInput = (devices = []) => {
  const d = (devices || []).find((x) => x?.kind === 'audioinput' && x?.deviceId === 'default');
  return d ? { deviceId: 'default', label: stripDefaultPrefix(d.label) } : null;
};

/** Physical inputs worth probing ('default'/'communications' are aliases of these). */
export const probeTargets = (devices = [], cap = MIC_PROBE_CAP) =>
  (devices || [])
    .filter((d) => d?.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
    .slice(0, cap);

/** Time-domain RMS of a getByteTimeDomainData frame (0..1). Same math as idle ear. */
export const rmsOfFrame = (bytes = []) => {
  if (!bytes || !bytes.length) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const v = (bytes[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / bytes.length);
};

/** Loose name compare: case/punct/space-insensitive, prefix-stripped. */
export const normalizeName = (label = '') =>
  stripDefaultPrefix(label).toLowerCase().replace(/[^a-z0-9]+/g, '');

/** True when the two labels refer to the same device (or both blank). */
export const sameDeviceName = (a, b) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
};

const shortName = (label = '') => {
  const s = stripDefaultPrefix(label);
  return s.length > 22 ? `${s.slice(0, 22)}…` : s;
};

/**
 * Verdict from one probe run. Pure.
 * @param {object} p
 * @param {Array}  p.devices       full enumerateDevices audioinput list (post-permission)
 * @param {object|null} p.edgeDefault  {label} from findEdgeDefaultInput
 * @param {string} p.pinnedLabel   pinned client-mic label ('' = none yet)
 * @param {Array}  p.results       [{ label, sampleRate, maxRms }] for probed devices
 * @returns {{tone:'pass'|'fail'|'warn', headline:string, hints:string[], pinned:object|null,
 *           edgeDefaultMismatch:boolean, hzWarning:boolean}}
 */
export const summarizeProbe = ({ devices = [], edgeDefault = null, pinnedLabel = '', results = [] }) => {
  const hints = [];
  const pinned = results.find((r) => sameDeviceName(r.label, pinnedLabel)) || null;

  // 1) Pinned pick must exist in Edge's (post-permission) device list.
  const stillListed = (devices || []).some((d) => sameDeviceName(d.label, pinnedLabel) && d.label);
  if (pinnedLabel && !stillListed) {
    return {
      tone: 'warn',
      headline: `Pinned mic "${shortName(pinnedLabel)}" is gone from Edge's list`,
      hints: ['Renamed or unplugged — re-pick the client mic in the dropdown.'],
      pinned: null,
      edgeDefaultMismatch: false,
      hzWarning: false,
    };
  }

  // 2) No pick yet → coach, don't fail.
  if (!pinnedLabel) {
    return {
      tone: 'warn',
      headline: 'Pick your client mic, then TEST again',
      hints: ['The client mic is the device the platform grabs — usually a Voicemeeter/VB-Cable OUT.'],
      pinned: null,
      edgeDefaultMismatch: false,
      hzWarning: false,
    };
  }

  // 3) Not probed (stream failed to open).
  if (!pinned) {
    return {
      tone: 'fail',
      headline: `Could not open "${shortName(pinnedLabel)}" — clients would hear nothing`,
      hints: ['Device busy or claimed by another app (VoiceMeeter?) — close/reopen it, or re-pick.'],
      pinned: null,
      edgeDefaultMismatch: false,
      hzWarning: false,
    };
  }

  const live = pinned.maxRms >= MIC_RMS_THRESHOLD;
  let tone = live ? 'pass' : 'fail';
  const headline = live
    ? `LIVE — your voice arrived on ${shortName(pinnedLabel)}`
    : `NO SIGNAL on ${shortName(pinnedLabel)} — clients would hear nothing`;
  if (!live) {
    hints.push('VoiceMeeter: check the mic strip is not muted and routes to the bus feeding this OUT.');
    hints.push('Windows: Settings → Sound → Input → this device → volume/mute.');
  }

  // 4) Edge default ≠ pinned: the platform tab follows Edge's default, not ours.
  const edgeDefaultMismatch = !!edgeDefault?.label && !sameDeviceName(edgeDefault.label, pinnedLabel);
  if (edgeDefaultMismatch) {
    if (tone === 'pass') tone = 'warn';
    hints.push(`Edge default mic = "${shortName(edgeDefault.label)}" — a platform tab on default grabs THAT, not your pinned pick. Match them (Edge Settings → Site permissions → Microphone, or pin this one).`);
  }

  // 5) Sample-rate mismatch is the classic VB silent/garble cause.
  const hzWarning = !!pinned.sampleRate && pinned.sampleRate !== 48000;
  if (hzWarning) {
    hints.push(`This mic runs at ${Math.round(pinned.sampleRate / 100) / 10}kHz, not 48k — set VoiceMeeter + Windows + cable endpoints all to 48k or audio can arrive silent/garbled.`);
  }

  return { tone, headline, hints, pinned, edgeDefaultMismatch, hzWarning };
};

// ---------- chip ----------

const TONE_GLYPH = { pass: '✅', fail: '❌', warn: '⚠️' };
const TONE_COLOR = { pass: '#34d399', fail: '#f87171', warn: '#fbbf24' };

/** Chip model for the header: text + color from the last stored verdict. */
export const formatMicChip = (last, { fallbackLabel = '' } = {}) => {
  if (last?.tone && last?.at) {
    const time = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      text: `🎤 ${shortName(last.label || fallbackLabel)} ${TONE_GLYPH[last.tone] || ''} ${time}`,
      color: TONE_COLOR[last.tone] || '#9dffed',
      tone: last.tone,
    };
  }
  if (fallbackLabel) {
    return { text: `🎤 ${shortName(fallbackLabel)} — untested`, color: '#94a3b8', tone: 'idle' };
  }
  return null;
};
