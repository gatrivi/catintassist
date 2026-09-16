import {
  extractPeakHz,
  buildRingSignature,
  matchRingSignature,
} from "./ringSignature";

/** Synthetic byte-FFT frame: a tone at binHz with given magnitude. */
const frameWith = (sampleRate, bins, tones) => {
  const b = new Uint8Array(bins).fill(4);
  const binHz = sampleRate / 2 / bins;
  tones.forEach(({ hz, mag }) => {
    const i = Math.round(hz / binHz);
    b[i] = mag;
    b[i - 1] = mag - 30; // shoulder bins so the local-peak rule holds
    b[i + 1] = mag - 30;
  });
  return b;
};

const hasHz = (peaks, target, tol = 25) =>
  peaks.some((p) => Math.abs(p - target) <= tol);

describe("ringSignature (v4.104.0 robot mode)", () => {
  const SR = 48000;
  const BINS = 1024; // fftSize 2048 → ~23Hz/bin

  test("extractPeakHz finds the dominant tones", () => {
    const peaks = extractPeakHz(
      frameWith(SR, BINS, [
        { hz: 440, mag: 220 },
        { hz: 480, mag: 200 },
        { hz: 1300, mag: 180 },
      ]),
      SR,
    );
    expect(hasHz(peaks, 440)).toBe(true);
    expect(hasHz(peaks, 480)).toBe(true);
    expect(hasHz(peaks, 1300)).toBe(true);
  });

  test("extractPeakHz drops quiet frames (below magnitude floor)", () => {
    const peaks = extractPeakHz(frameWith(SR, BINS, [{ hz: 440, mag: 60 }]), SR);
    expect(peaks).toEqual([]);
  });

  test("buildRingSignature keeps recurring tones, needs quorum", () => {
    const ring = [{ hz: 440, mag: 220 }, { hz: 480, mag: 200 }];
    const frames = Array.from({ length: 12 }, () =>
      extractPeakHz(frameWith(SR, BINS, ring), SR),
    );
    const sig = buildRingSignature(frames);
    expect(hasHz(sig.peaks, 440)).toBe(true);
    expect(hasHz(sig.peaks, 480)).toBe(true);
    // Too few tonal frames → no signature.
    expect(buildRingSignature(frames.slice(0, 3))).toBeNull();
  });

  test("matchRingSignature: all learned tones must appear", () => {
    const sig = { peaks: [440, 480] };
    expect(matchRingSignature(sig, [445, 478, 3000])).toBe(true);
    expect(matchRingSignature(sig, [445, 3000])).toBe(false); // 480 missing
    expect(matchRingSignature(null, [440, 480])).toBe(false);
  });
});
