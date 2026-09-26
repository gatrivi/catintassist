/**
 * CONNECT truth helpers (v4.153.0).
 *
 * Bug being fixed: pressing CONNECT sometimes produced NO Deepgram audio at
 * all, with no message anywhere. Three causes live here as pure functions so
 * they can be unit-tested without a browser:
 *
 * 1. A reused stream that is technically "active" but dead/muted (tab share
 *    stopped producing audio, headset unplugged) was trusted as-is.
 * 2. Nothing ever re-checked "is Deepgram actually live?" after the press.
 * 3. A connected-but-silent pipeline looked identical to a healthy one.
 *
 * Keep it small and dumb. No React here.
 */

export const LAST_CONNECT_KEY = 'catint_last_connect_v1';

/**
 * What one CONNECT press should do. ONE function, so the header and the idle
 * pane can never disagree.
 *
 * v4.153.0: `audioAttached` now means "Deepgram is really transcribing"
 * (sockets open + audio flowing), not merely "state says connected".
 */
export const resolveConnectIntent = ({
  vaultNeedsDecrypt = false,
  apiKeyMissingNoVault = false,
  isZombieCall = false,
  audioAttached = false,
  doubleTap = false,
} = {}) => {
  // A locked/missing key must open its one-step fix — never start capture.
  if (vaultNeedsDecrypt) return 'open-key-unlock';
  if (apiKeyMissingNoVault) return 'open-key-settings';
  if (isZombieCall) return 'recovery';
  if (!audioAttached) return doubleTap ? 'attach-fresh' : 'attach';
  return doubleTap ? 'connect-another-tab' : 'start-call';
};

/** A stream is reusable only if it can still carry audio. */
export const isReusableStream = (stream, source, currentSource) => {
  if (!stream) return { ok: false, why: 'no_stream' };
  if (source !== currentSource) return { ok: false, why: 'source_changed' };
  if (!stream.active) return { ok: false, why: 'stream_ended' };
  const tracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
  if (!tracks.length) return { ok: false, why: 'no_audio_track' };
  const dead = tracks.filter((t) => t.readyState && t.readyState !== 'live');
  if (dead.length) return { ok: false, why: 'track_ended' };
  const muted = tracks.filter((t) => t.muted);
  if (muted.length === tracks.length) return { ok: false, why: 'all_tracks_muted' };
  return { ok: true, why: 'live' };
};

/**
 * CONNECT self-heal: after a press, if Deepgram is still not live, ask once
 * for a rebuild. Returns true only while inside the healing window, so we
 * never loop (one heal per press).
 */
export const CONNECT_HEAL_DELAY_MS = 1500;
export const CONNECT_HEAL_WINDOW_MS = 6000;

export const shouldHealConnect = ({
  pressedAt = 0,
  sttLive = false,
  healed = false,
  now = Date.now(),
  delayMs = CONNECT_HEAL_DELAY_MS,
  windowMs = CONNECT_HEAL_WINDOW_MS,
} = {}) => {
  if (sttLive) return false;
  if (healed) return false;
  if (!pressedAt) return false;
  const age = now - pressedAt;
  if (age < delayMs) return false;
  return age <= windowMs;
};

/** "Connected" that never received audio is NOT healthy — say so. */
export const isConnectedButSilent = ({
  connectionState = 'idle',
  audioChunksSent = false,
  connectedSince = 0,
  now = Date.now(),
  graceMs = 8000,
} = {}) => {
  if (connectionState !== 'connected') return false;
  if (audioChunksSent) return false;
  // connectedSince 0 = unknown start → an ancient connection that never spoke.
  return now - (connectedSince || 0) >= graceMs;
};

/** Compact one-line record of what a connect attempt actually did. */export const buildConnectSummary = ({
  source = 'none',
  ok = false,
  reason = '',
  socketEn = 'pending',
  socketEs = 'pending',
  audioChunksSent = false,
  closeCode = null,
  at = Date.now(),
} = {}) => ({
  v: 1,
  at,
  source,
  ok: !!ok,
  reason: String(reason || '').slice(0, 200),
  socketEn,
  socketEs,
  audioChunksSent: !!audioChunksSent,
  closeCode: closeCode ?? null,
});

export const recordLastConnect = (summary, storage = safeStorage()) => {
  try {
    storage?.setItem(LAST_CONNECT_KEY, JSON.stringify(summary));
  } catch (_) {}
};

export const readLastConnect = (storage = safeStorage()) => {
  try {
    const raw = storage?.getItem(LAST_CONNECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

function safeStorage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch (_) {
    return null;
  }
}
