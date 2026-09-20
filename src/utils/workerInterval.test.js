import { createUnthrottledInterval } from './workerInterval';

// jsdom has no Worker/URL.createObjectURL, so these exercise the setInterval
// fallback — same contract the worker path must honor (tick, stop, idempotent).

describe('createUnthrottledInterval fallback contract', () => {
  it('ticks repeatedly until stopped', (done) => {
    let ticks = 0;
    const stop = createUnthrottledInterval(() => { ticks += 1; }, 10);
    setTimeout(() => {
      expect(ticks).toBeGreaterThanOrEqual(2);
      stop();
      done();
    }, 60);
  }, 5000);

  it('stop() halts the ticks', (done) => {
    let ticks = 0;
    const stop = createUnthrottledInterval(() => { ticks += 1; }, 10);
    setTimeout(() => {
      stop();
      const atStop = ticks;
      setTimeout(() => {
        expect(ticks).toBe(atStop);
        done();
      }, 60);
    }, 40);
  }, 5000);

  it('stop() is idempotent', () => {
    const stop = createUnthrottledInterval(() => {}, 10);
    expect(() => { stop(); stop(); }).not.toThrow();
  });
});
