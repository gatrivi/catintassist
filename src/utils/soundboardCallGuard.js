export const DEFAULT_COOLDOWN_MS = 3000;
export const DEFAULT_TTL_MS = 60000;

let nextTokenId = 1;
const activeTokens = new Map(); // tokenId -> { reason, expiresAt }
let suppressedUntil = 0;

function pruneExpiredTokens(now) {
  for (const [id, entry] of activeTokens.entries()) {
    if (entry.expiresAt <= now) {
      activeTokens.delete(id);
    }
  }
}

/**
 * Registers an active soundboard playback/recording token that suppresses
 * Idle Ear VAD wake and speech/autopilot call auto-start.
 *
 * @param {string} [reason='unknown'] - Diagnostic label (e.g. 'sink_clip', 'local_preview', 'recording').
 * @param {object} [options]
 * @param {number} [options.cooldownMs=DEFAULT_COOLDOWN_MS] - Post-release tail cooldown in ms.
 * @param {number} [options.ttlMs=DEFAULT_TTL_MS] - Safety auto-expiry in ms if release() is never called.
 * @returns {(overrideCooldownMs?: number) => void} Idempotent release function.
 */
export function beginSoundboardAudioGuard(reason = 'unknown', options = {}) {
  const {
    cooldownMs = DEFAULT_COOLDOWN_MS,
    ttlMs = DEFAULT_TTL_MS,
  } = options;

  const now = Date.now();
  pruneExpiredTokens(now);

  const id = nextTokenId++;
  const safeTtl = Math.max(0, Number.isFinite(ttlMs) ? ttlMs : DEFAULT_TTL_MS);
  activeTokens.set(id, {
    reason,
    expiresAt: now + safeTtl,
  });

  let released = false;

  return function release(overrideCooldownMs) {
    if (released) return;
    released = true;

    activeTokens.delete(id);

    const effectiveCooldown = Math.max(
      0,
      Number.isFinite(overrideCooldownMs)
        ? overrideCooldownMs
        : Number.isFinite(cooldownMs)
          ? cooldownMs
          : DEFAULT_COOLDOWN_MS
    );

    const releaseNow = Date.now();
    suppressedUntil = Math.max(suppressedUntil, releaseNow + effectiveCooldown);
  };
}

/**
 * Returns true while any non-expired soundboard audio token is active
 * or while the post-playback cooldown window is still in effect.
 *
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
export function isSoundboardAudioSuppressed(now = Date.now()) {
  pruneExpiredTokens(now);
  return activeTokens.size > 0 || now < suppressedUntil;
}

/**
 * Clears all active tokens and cooldown state (intended for unit tests).
 */
export function resetSoundboardAudioGuard() {
  activeTokens.clear();
  suppressedUntil = 0;
  nextTokenId = 1;
}
