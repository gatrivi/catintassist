import { nextLiveHeightLock } from './liveBubbleHeight';

describe('nextLiveHeightLock', () => {
  test('seal-split tail (text shrink) releases the lock — kills the void', () => {
    // Bubble held a full paragraph (300px, 180 chars); tail is now "Okay?" (5 chars).
    // Rect still measures 300px because the old minHeight lock is applied.
    const out = nextLiveHeightLock({ height: 300, textLen: 180 }, 300, 5);
    expect(out).toEqual({ release: true });
  });

  test('growth updates lock and rerenders', () => {
    const out = nextLiveHeightLock({ height: 100, textLen: 50 }, 140, 80);
    expect(out).toEqual({ set: { height: 140, textLen: 80 }, rerender: true });
  });

  test('jitter within ±2px is ignored', () => {
    expect(nextLiveHeightLock({ height: 100, textLen: 50 }, 101, 50)).toBeNull();
  });

  test('measured shrink > 8px locks down', () => {
    const out = nextLiveHeightLock({ height: 100, textLen: 50 }, 80, 50);
    expect(out).toEqual({ set: { height: 80, textLen: 50 }, rerender: true });
  });

  test('textLen refresh without height change does not rerender', () => {
    const out = nextLiveHeightLock({ height: 100, textLen: 50 }, 100, 51);
    expect(out).toEqual({ set: { height: 100, textLen: 51 }, rerender: false });
  });

  test('first measurement sets lock', () => {
    const out = nextLiveHeightLock(undefined, 60, 30);
    expect(out).toEqual({ set: { height: 60, textLen: 30 }, rerender: true });
  });
});
