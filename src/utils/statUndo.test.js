import {
  captureStatUndo, readStatUndo, applyStatUndo, clearStatUndo,
  parseMinuteCorrection, formatMinuteChange, STAT_UNDO_KEY, STATS_KEY,
} from './statUndo';

// v4.162.0. Two separate promises, both about money:
//
//  1. Nothing in the goal dial writes without a way back.
//  2. An emptied "banked/mo" box is a typo, not an instruction to zero the month.
//     (`Number('') === 0` passed the old `>= 0` check and did exactly that.)

describe('parseMinuteCorrection', () => {
  test('refuses an empty or blank field instead of writing 0', () => {
    expect(parseMinuteCorrection('')).toBeNull();
    expect(parseMinuteCorrection('   ')).toBeNull();
    expect(parseMinuteCorrection(null)).toBeNull();
    expect(parseMinuteCorrection(undefined)).toBeNull();
  });

  test('refuses negatives and junk', () => {
    ['-1', '-0.5', 'abc', '12abc', 'NaN', 'Infinity'].forEach((bad) => {
      expect(parseMinuteCorrection(bad)).toBeNull();
    });
  });

  test('accepts a real number, rounded to whole minutes', () => {
    expect(parseMinuteCorrection('1234')).toBe(1234);
    expect(parseMinuteCorrection(' 1234 ')).toBe(1234);
    expect(parseMinuteCorrection('1234.6')).toBe(1235);
    expect(parseMinuteCorrection('0')).toBe(0); // an explicit zero is allowed
  });
});

describe('formatMinuteChange', () => {
  test('always shows old → new with the signed delta', () => {
    expect(formatMinuteChange(9240, 3360)).toBe('9240m → 3360m (-5880)');
    expect(formatMinuteChange(1000, 5000)).toBe('1000m → 5000m (+4000)');
    expect(formatMinuteChange(1000, 1000)).toBe('1000m → 1000m (0)');
  });

  test('survives junk without printing NaN', () => {
    expect(formatMinuteChange(undefined, null)).toBe('0m → 0m (0)');
    expect(formatMinuteChange('x', 'y')).toBe('0m → 0m (0)');
  });
});

describe('stat undo', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  test('captures, reads back and restores the exact previous stats', () => {
    const before = { monthlyMinutes: 9240, goalMinutes: 5500, dailyMinutes: 1000 };
    localStorage.setItem(STATS_KEY, JSON.stringify(before));
    captureStatUndo('re-sum month');

    // the write that needs undoing
    const after = { ...before, monthlyMinutes: 3360 };
    localStorage.setItem(STATS_KEY, JSON.stringify(after));

    const restored = applyStatUndo();
    expect(restored).toEqual(before);
    expect(JSON.parse(localStorage.getItem(STATS_KEY))).toEqual(before);
  });

  test('the snapshot survives a reload, and is one level deep', () => {
    localStorage.setItem(STATS_KEY, JSON.stringify({ monthlyMinutes: 100 }));
    captureStatUndo('first');
    // A second destructive write replaces the snapshot rather than stacking:
    // the operator wants "put my month back", not a rewind history.
    localStorage.setItem(STATS_KEY, JSON.stringify({ monthlyMinutes: 200 }));
    captureStatUndo('second');

    expect(readStatUndo().label).toBe('second');
    expect(applyStatUndo()).toEqual({ monthlyMinutes: 200 });
    expect(readStatUndo()).toBeNull();
    expect(applyStatUndo()).toBeNull();
  });

  test('nothing to undo returns null and never touches storage', () => {
    localStorage.setItem(STATS_KEY, JSON.stringify({ monthlyMinutes: 7 }));
    expect(readStatUndo()).toBeNull();
    expect(applyStatUndo()).toBeNull();
    expect(JSON.parse(localStorage.getItem(STATS_KEY))).toEqual({ monthlyMinutes: 7 });
  });

  test('corrupt storage is ignored, not thrown', () => {
    localStorage.setItem(STAT_UNDO_KEY, '{not json');
    expect(readStatUndo()).toBeNull();
    expect(applyStatUndo()).toBeNull();
    localStorage.setItem(STAT_UNDO_KEY, '{"label":"x"}'); // no stats key
    expect(readStatUndo()).toBeNull();
  });

  test('clearStatUndo removes only the snapshot', () => {
    localStorage.setItem(STATS_KEY, JSON.stringify({ monthlyMinutes: 5 }));
    captureStatUndo('x');
    clearStatUndo();
    expect(readStatUndo()).toBeNull();
    expect(JSON.parse(localStorage.getItem(STATS_KEY))).toEqual({ monthlyMinutes: 5 });
  });
});
