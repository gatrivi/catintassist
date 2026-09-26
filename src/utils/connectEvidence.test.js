/**
 * v4.153.0 — CONNECT truth helpers.
 *
 * The bug: pressing CONNECT could end with NO Deepgram audio and no message.
 * These are the pure decisions that prevent it.
 */
import {
  isReusableStream,
  shouldHealConnect,
  isConnectedButSilent,
  resolveConnectIntent,
  buildConnectSummary,
  recordLastConnect,
  readLastConnect,
  LAST_CONNECT_KEY,
} from './connectEvidence';

const track = (over = {}) => ({ readyState: 'live', muted: false, ...over });
const stream = (tracks, over = {}) => ({
  active: true,
  getAudioTracks: () => tracks,
  ...over,
});

describe('isReusableStream', () => {
  test('accepts a live stream of the same source', () => {
    expect(isReusableStream(stream([track()]), 'tab', 'tab')).toEqual({ ok: true, why: 'live' });
  });

  test('rejects an ended stream (tab share revoked)', () => {
    const s = stream([track()], { active: false });
    expect(isReusableStream(s, 'tab', 'tab').why).toBe('stream_ended');
  });

  test('rejects a stream whose track ended mid-call', () => {
    expect(isReusableStream(stream([track({ readyState: 'ended' })]), 'tab', 'tab').why).toBe('track_ended');
  });

  test('rejects a fully muted stream — this is what "connected but silent" was', () => {
    const s = stream([track({ muted: true })]);
    expect(isReusableStream(s, 'mic', 'mic').why).toBe('all_tracks_muted');
  });

  test('keeps a stream with one good track out of one muted track', () => {
    const s = stream([track({ muted: true }), track()]);
    expect(isReusableStream(s, 'mic', 'mic').ok).toBe(true);
  });

  test('rejects a source switch (mic press while tab stream is open)', () => {
    expect(isReusableStream(stream([track()]), 'mic', 'tab').why).toBe('source_changed');
  });

  test('rejects no stream / no audio track', () => {
    expect(isReusableStream(null, 'tab', 'tab').why).toBe('no_stream');
    expect(isReusableStream(stream([]), 'tab', 'tab').why).toBe('no_audio_track');
  });
});

describe('shouldHealConnect', () => {
  const base = { pressedAt: 1_000_000, healed: false };

  test('does nothing before the delay', () => {
    expect(shouldHealConnect({ ...base, now: 1_000_500 })).toBe(false);
  });

  test('heals once inside the window when nothing is live', () => {
    expect(shouldHealConnect({ ...base, now: 1_002_000 })).toBe(true);
  });

  test('never heals twice for one press', () => {
    expect(shouldHealConnect({ ...base, healed: true, now: 1_002_000 })).toBe(false);
  });

  test('never heals a live pipeline', () => {
    expect(shouldHealConnect({ ...base, sttLive: true, now: 1_002_000 })).toBe(false);
  });

  test('gives up after the window (no connect/rebuild loop)', () => {
    expect(shouldHealConnect({ ...base, now: 1_030_000 })).toBe(false);
  });

  test('nothing to heal without a press', () => {
    expect(shouldHealConnect({ pressedAt: 0, now: 5_000_000 })).toBe(false);
  });
});

describe('isConnectedButSilent', () => {
  test('flags a connection that never sent audio', () => {
    expect(
      isConnectedButSilent({ connectionState: 'connected', connectedSince: 0, now: 60_000 }),
    ).toBe(true);
  });

  test('quiet while audio flows is healthy', () => {
    expect(
      isConnectedButSilent({
        connectionState: 'connected',
        audioChunksSent: true,
        connectedSince: 0,
        now: 600_000,
      }),
    ).toBe(false);
  });

  test('grace period: a fresh connection is not flagged yet', () => {
    expect(
      isConnectedButSilent({ connectionState: 'connected', connectedSince: 1000, now: 4000 }),
    ).toBe(false);
    expect(
      isConnectedButSilent({ connectionState: 'connected', connectedSince: 1000, now: 12_000 }),
    ).toBe(true);
  });

  test('never flags non-connected states', () => {
    expect(isConnectedButSilent({ connectionState: 'connecting', connectedSince: 1000, now: 99_000 })).toBe(false);
    expect(isConnectedButSilent({ connectionState: 'error', connectedSince: 1000, now: 99_000 })).toBe(false);
  });
});

describe('resolveConnectIntent', () => {
  test('missing/locked key opens the fix, never audio capture', () => {
    expect(resolveConnectIntent({ vaultNeedsDecrypt: true, audioAttached: false })).toBe('open-key-unlock');
    expect(resolveConnectIntent({ apiKeyMissingNoVault: true })).toBe('open-key-settings');
  });

  test('zombie call recovers first', () => {
    expect(resolveConnectIntent({ isZombieCall: true, audioAttached: true })).toBe('recovery');
  });

  test('no live Deepgram → attach audio (the v4.153.0 fix)', () => {
    expect(resolveConnectIntent({ audioAttached: false })).toBe('attach');
    expect(resolveConnectIntent({ audioAttached: false, doubleTap: true })).toBe('attach-fresh');
  });

  test('live Deepgram → start call, double tap re-picks the tab', () => {
    expect(resolveConnectIntent({ audioAttached: true })).toBe('start-call');
    expect(resolveConnectIntent({ audioAttached: true, doubleTap: true })).toBe('connect-another-tab');
  });
});

describe('last connect record', () => {
  test('round-trips a one-line summary (evidence for the next failure)', () => {
    const store = (() => {
      const m = new Map();
      return {
        setItem: (k, v) => m.set(k, v),
        getItem: (k) => (m.has(k) ? m.get(k) : null),
      };
    })();
    recordLastConnect(
      buildConnectSummary({ source: 'tab', ok: false, reason: 'picker cancelled', closeCode: 1006 }),
      store,
    );
    const read = readLastConnect(store);
    expect(read.source).toBe('tab');
    expect(read.ok).toBe(false);
    expect(read.reason).toBe('picker cancelled');
    expect(read.closeCode).toBe(1006);
  });

  test('survives a broken store without throwing', () => {
    const broken = {
      setItem() {
        throw new Error('nope');
      },
      getItem() {
        throw new Error('nope');
      },
    };
    expect(() => recordLastConnect(buildConnectSummary({}), broken)).not.toThrow();
    expect(readLastConnect(broken)).toBeNull();
  });

  test('uses sessionStorage by default', () => {
    recordLastConnect(buildConnectSummary({ source: 'mic', ok: true }));
    expect(sessionStorage.getItem(LAST_CONNECT_KEY)).toContain('mic');
    sessionStorage.clear();
  });
});
