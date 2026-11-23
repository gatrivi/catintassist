import {
  CHIME_TUNES,
  resolveOffCallChimeTone,
  readOffCallChimeSettings,
  saveOffCallChimeSettings,
  playOffCallChime,
  calculateChimeMetricModulation,
  synthesizeMetricTune,
  CHIME_STORAGE_KEY,
} from './offCallChime';

describe('offCallChime', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('resolveOffCallChimeTone', () => {
    test('silences chime (returns null) when isOnAvail is true off-call', () => {
      const tune = resolveOffCallChimeTone({ isOnAvail: true, isActive: false, deficitMins: 60 });
      expect(tune).toBeNull();
    });

    test('silences chime (returns null) when isOnAvail is true in live call mode', () => {
      const tune = resolveOffCallChimeTone({ isOnAvail: true, isActive: true, silenceSecs: 90 });
      expect(tune).toBeNull();
    });

    test('silences chime (returns null) during healthy break (breakLeft >= 15)', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: true, breakLeft: 45 });
      expect(tune).toBeNull();
    });

    test('resolves break_low when on break and breakLeft < 15 and > 0', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: true, breakLeft: 10 });
      expect(tune.id).toBe('break_low');
    });

    test('resolves break_overtime when on break and breakLeft <= 0', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: true, breakLeft: 0 });
      expect(tune.id).toBe('break_overtime');
    });

    test('resolves ahead when deficit < -30 (ahead of pace)', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: -45 });
      expect(tune.id).toBe('ahead');
    });

    test('resolves on_pace when deficit within ±30', () => {
      const tune1 = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: 0 });
      expect(tune1.id).toBe('on_pace');

      const tune2 = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: 25 });
      expect(tune2.id).toBe('on_pace');

      const tune3 = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: -20 });
      expect(tune3.id).toBe('on_pace');
    });

    test('resolves behind_mild when deficit > 30 and idle <= 5m (300s)', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: 60, idleSecs: 180 });
      expect(tune.id).toBe('behind_mild');
    });

    test('resolves behind_urgent when deficit > 30 and idle > 5m (300s)', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: 60, idleSecs: 360 });
      expect(tune.id).toBe('behind_urgent');
    });

    test('prefers gap when provided', () => {
      const tune = resolveOffCallChimeTone({ isBreakActive: false, deficitMins: 0, gap: -60 });
      expect(tune.id).toBe('ahead');
    });

    test('returns null when active and silence < 60s', () => {
      const tune = resolveOffCallChimeTone({ isActive: true, silenceSecs: 30 });
      expect(tune).toBeNull();
    });

    test('returns call_silence when active and silence >= 60s and not on hold', () => {
      const tune = resolveOffCallChimeTone({ isActive: true, isHold: false, silenceSecs: 75 });
      expect(tune.id).toBe('call_silence');
    });

    test('returns null when active and on hold <= 15m (900s)', () => {
      const tune = resolveOffCallChimeTone({ isActive: true, isHold: true, holdSeconds: 300, silenceSecs: 300 });
      expect(tune).toBeNull();
    });

    test('returns hold_overtime when active and on hold > 15m (900s)', () => {
      const tune = resolveOffCallChimeTone({ isActive: true, isHold: true, holdSeconds: 950 });
      expect(tune.id).toBe('hold_overtime');
    });
  });

  describe('settings persistence', () => {
    test('defaults to enabled: true and volume: 0.6', () => {
      const s = readOffCallChimeSettings();
      expect(s.enabled).toBe(true);
      expect(s.volume).toBe(0.6);
    });

    test('saves and reads updated settings', () => {
      saveOffCallChimeSettings({ enabled: false, volume: 0.8 });
      const s = readOffCallChimeSettings();
      expect(s.enabled).toBe(false);
      expect(s.volume).toBe(0.8);
    });
  });

  describe('playOffCallChime audio safety', () => {
    test('returns stop handler safely when AudioContext is mock or unavailable', () => {
      const fakeCtx = {
        currentTime: 0,
        destination: {},
        createGain: () => ({
          gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
          connect: jest.fn(),
        }),
        createOscillator: () => ({
          type: 'triangle',
          frequency: { setValueAtTime: jest.fn() },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        }),
      };

      const handle = playOffCallChime(CHIME_TUNES.ahead, { audioCtx: fakeCtx, force: true });
      expect(typeof handle.stop).toBe('function');
      expect(() => handle.stop()).not.toThrow();
    });
  });

  describe('calculateChimeMetricModulation and synthesizeMetricTune', () => {
    test('calculates distinct modulation across days of week', () => {
      const modSun = calculateChimeMetricModulation({ dayOfWeek: 0, dayOfMonth: 1, deficitMins: 0, dailyMinutes: 0 });
      const modFri = calculateChimeMetricModulation({ dayOfWeek: 5, dayOfMonth: 1, deficitMins: 0, dailyMinutes: 0 });
      expect(modSun.totalCents).toBe(0);
      expect(modFri.totalCents).toBe(60);
      expect(modFri.freqMultiplier).toBeGreaterThan(modSun.freqMultiplier);
    });

    test('tilts pitch downward when behind pace and upward when ahead', () => {
      const modBehind = calculateChimeMetricModulation({ dayOfWeek: 2, dayOfMonth: 10, deficitMins: 200, dailyMinutes: 0 });
      const modAhead = calculateChimeMetricModulation({ dayOfWeek: 2, dayOfMonth: 10, deficitMins: -200, dailyMinutes: 0 });
      expect(modBehind.totalCents).toBeLessThan(modAhead.totalCents);
      expect(modBehind.freqMultiplier).toBeLessThan(modAhead.freqMultiplier);
    });

    test('transposes chime notes while preserving harmonic interval ratio', () => {
      const base = CHIME_TUNES.on_pace; // 2 notes: D5 (587.33), A5 (880.00)
      const tuned = synthesizeMetricTune(base, {
        dayOfWeek: 3,
        dayOfMonth: 15,
        deficitMins: 50,
        dailyMinutes: 180,
      });

      expect(tuned.notes).toHaveLength(base.notes.length);
      expect(tuned.notes[0].freq).not.toBe(base.notes[0].freq);

      // Original ratio: 880 / 587.33 ≈ 1.4983 (perfect fifth)
      const origRatio = base.notes[1].freq / base.notes[0].freq;
      const tunedRatio = tuned.notes[1].freq / tuned.notes[0].freq;
      expect(Math.abs(tunedRatio - origRatio)).toBeLessThan(0.01);
    });
  });
});
