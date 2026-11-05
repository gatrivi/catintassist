import { createCallVadGate, feedCallVad, callVadThreshold, CALL_VAD_MIN_THRESHOLD, CALL_VAD_MAX_THRESHOLD } from './callVadGate';

const feed = (gate, rms, n) => { let hit = false; for (let i = 0; i < n; i++) hit = feedCallVad(gate, rms) || hit; return hit; };

describe('callVadGate (v4.205.0)', () => {
  it('quiet tab speech (0.01) counts as speech — old fixed 0.02 bar missed it', () => {
    const g = createCallVadGate();
    feed(g, 0.0015, 40); // quiet line
    expect(feed(g, 0.01, 2)).toBe(true);
  });
  it('a single pop is not speech', () => {
    const g = createCallVadGate();
    feed(g, 0.0015, 40);
    expect(feedCallVad(g, 0.05)).toBe(false);
  });
  it('steady hiss never counts as speech', () => {
    const g = createCallVadGate();
    expect(feed(g, 0.003, 400)).toBe(false);
  });
  it('noisy line raises the bar but never above the old 0.02', () => {
    expect(callVadThreshold(0.5)).toBe(CALL_VAD_MAX_THRESHOLD);
    expect(callVadThreshold(0)).toBe(CALL_VAD_MIN_THRESHOLD);
  });
  it('loud speech never teaches the floor', () => {
    const g = createCallVadGate();
    feed(g, 0.0015, 20);
    const before = g.floor;
    feed(g, 0.05, 200);
    expect(g.floor).toBe(before);
    expect(g.peak).toBe(0.05);
  });
});
