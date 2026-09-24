import {
  dgStatus,
  connectStallVerdict,
  isSocketHealthy,
  shouldAutoZap,
  DG_AUTO_ZAP_SILENCE_MS,
  DG_AUTO_ZAP_COOLDOWN_MS,
  CONNECT_STALL_MAX_RETRIES,
  DG_FRESH_TEXT_MS,
  DG_QUIET_MS,
  DG_STUCK_MS,
} from './dgStatus';

const NOW = 1_000_000_000;
const base = {
  connectionState: 'connected',
  isActive: true,
  enOpen: true,
  esOpen: true,
  now: NOW,
};

describe('dgStatus truthful chip flags (v4.136.0)', () => {
  it(`reads TEXT ✓ when any transcript landed within ${DG_FRESH_TEXT_MS / 1000}s (no confidence gate)`, () => {
    const s = dgStatus({ ...base, lastDataTime: NOW - 10_000, lastDeepgramMessageAt: NOW - 10_000 });
    expect(s.freshText).toBe(true);
    expect(s.quiet).toBe(false);
    expect(s.stuck).toBe(false);
  });

  it('stays calm while dead air keeps Deepgram keepalive messages flowing', () => {
    const s = dgStatus({ ...base, lastDataTime: NOW - 90_000, lastDeepgramMessageAt: NOW - 5_000 });
    expect(s.freshText).toBe(false);
    expect(s.quiet).toBe(false);
    expect(s.stuck).toBe(false);
  });

  it(`reads QUIET between ${DG_QUIET_MS / 1000}s and ${DG_STUCK_MS / 1000}s of zero messages`, () => {
    const s = dgStatus({ ...base, lastDataTime: NOW - 40_000, lastDeepgramMessageAt: NOW - 40_000 });
    expect(s.quiet).toBe(true);
    expect(s.stuck).toBe(false);
  });

  it(`reads STUCK past ${DG_STUCK_MS / 1000}s of zero messages`, () => {
    const s = dgStatus({ ...base, lastDataTime: NOW - 70_000, lastDeepgramMessageAt: NOW - 70_000 });
    expect(s.stuck).toBe(true);
    expect(s.quiet).toBe(false);
  });

  it('reads STUCK the moment a socket is lost, even with fresh text', () => {
    const s = dgStatus({ ...base, lastDataTime: NOW - 5_000, lastDeepgramMessageAt: NOW - 5_000, esOpen: false });
    expect(s.stuck).toBe(true);
  });

  it('zero timestamps never fake TEXT ✓ and never hide a stall (epoch contract)', () => {
    const s = dgStatus({ ...base, lastDataTime: 0, lastDeepgramMessageAt: 0 });
    expect(s.freshText).toBe(false);
    expect(s.stuck).toBe(true);
  });

  it('off-call (warm idle ear) is never stale — v4.100.3 kept', () => {
    const s = dgStatus({ ...base, isActive: false, lastDataTime: NOW - 600_000, lastDeepgramMessageAt: NOW - 600_000 });
    expect(s.inCall).toBe(false);
    expect(s.quiet).toBe(false);
    expect(s.stuck).toBe(false);
    expect(s.freshText).toBe(false);
  });

  it('connecting/error states are never stale-flagged', () => {
    const connecting = dgStatus({ ...base, connectionState: 'connecting', lastDeepgramMessageAt: 0 });
    const errored = dgStatus({ ...base, connectionState: 'error', lastDeepgramMessageAt: 0 });
    expect(connecting.stuck).toBe(false);
    expect(connecting.quiet).toBe(false);
    expect(errored.stuck).toBe(false);
    expect(errored.quiet).toBe(false);
  });
});

describe('connectStallVerdict — 12s watchdog (v4.148.0)', () => {
  it('stands down once Deepgram sent anything (even just Metadata)', () => {
    expect(connectStallVerdict({ audioChunksSent: true, gotDgMessage: true })).toBe('ok');
  });

  it('stands down once a transcript already flowed', () => {
    expect(connectStallVerdict({ audioChunksSent: false, transcriptReceived: true })).toBe('ok');
  });

  it('fails with the no-audio guidance when audio never reached Deepgram', () => {
    expect(connectStallVerdict({ audioChunksSent: false, gotDgMessage: false })).toBe('fail-no-audio');
  });

  it('reconnects while budget remains when audio flows but Deepgram is mute', () => {
    expect(
      connectStallVerdict({ audioChunksSent: true, gotDgMessage: false, retriesLeft: CONNECT_STALL_MAX_RETRIES })
    ).toBe('stall-reconnect');
    expect(connectStallVerdict({ audioChunksSent: true, gotDgMessage: false, retriesLeft: 1 })).toBe('stall-reconnect');
  });

  it('hard-fails when the retry budget is spent', () => {
    expect(connectStallVerdict({ audioChunksSent: true, gotDgMessage: false, retriesLeft: 0 })).toBe('fail-silent');
  });
});

describe("isSocketHealthy — 'skipped' (Multilingual single-socket) is healthy (v4.148.0)", () => {
  it.each([
    ['open', true],
    ['skipped', true],
    ['connecting', false],
    ['pending', false],
    ['error', false],
    [undefined, false],
  ])('socketEs=%s → %s', (state, expected) => {
    expect(isSocketHealthy(state)).toBe(expected);
  });
});

describe('shouldAutoZap — 35s mid-call stall recovery (v4.148.1)', () => {
  const zap = (msgAgeMs = 40_000) =>
    shouldAutoZap({ msgAgeMs, audioProgressAgeMs: 3_000, sinceLastZapMs: DG_AUTO_ZAP_COOLDOWN_MS });

  it('zaps after 35s+ of zero Deepgram messages while audio still flows', () => {
    expect(zap(DG_AUTO_ZAP_SILENCE_MS)).toBe(true);
    expect(zap(90_000)).toBe(true);
  });

  it('holds fire during live dead air (messages still arriving)', () => {
    expect(zap(DG_AUTO_ZAP_SILENCE_MS - 1)).toBe(false);
    expect(zap(5_000)).toBe(false);
  });

  it('never zaps a dead recorder — that is the audio watchdog failure', () => {
    expect(shouldAutoZap({ msgAgeMs: 90_000, audioProgressAgeMs: 20_000, sinceLastZapMs: 999_999 })).toBe(false);
  });

  it('respects the 120s cooldown between recovery Zaps', () => {
    expect(shouldAutoZap({ msgAgeMs: 90_000, audioProgressAgeMs: 3_000, sinceLastZapMs: DG_AUTO_ZAP_COOLDOWN_MS - 1 })).toBe(false);
  });
});
