import { sttStallReason } from './dgStatus';

const live = { sinceConnectMs: 60000, audioProgressAgeMs: 500, msgAgeMs: 800, textAgeMs: 2000, speakingAgeMs: 100 };

describe('sttStallReason (v4.179.0)', () => {
  test('healthy flow = null', () => expect(sttStallReason(live)).toBeNull());
  test('grace after connect = null even if everything is dead', () =>
    expect(sttStallReason({ sinceConnectMs: 5000 })).toBeNull());
  test('recorder silent = no-audio', () =>
    expect(sttStallReason({ ...live, audioProgressAgeMs: 16000 })).toBe('no-audio'));
  test('Deepgram mute = no-reply', () =>
    expect(sttStallReason({ ...live, msgAgeMs: 21000 })).toBe('no-reply'));
  test('speaking + empty Results for 20s = deaf (the silent-stop bug)', () =>
    expect(sttStallReason({ ...live, textAgeMs: 25000 })).toBe('deaf'));
  test('dead air (nobody speaking) is not a fault', () =>
    expect(sttStallReason({ ...live, textAgeMs: 90000, speakingAgeMs: 30000 })).toBeNull());
  test('hold never hides a stall (hold = silence; speech lifts it)', () =>
    expect(sttStallReason({ ...live, textAgeMs: 90000, onHold: true })).toBe('deaf'));
});

describe('sttStallReason deaf window (v4.195.0)', () => {
  test('10s no words while speaking = deaf (was 20s)', () =>
    expect(sttStallReason({ ...live, textAgeMs: 11000 })).toBe('deaf'));
  test('a 6s pause between polls still counts as speaking (was 3s)', () =>
    expect(sttStallReason({ ...live, textAgeMs: 11000, speakingAgeMs: 6000 })).toBe('deaf'));
});
