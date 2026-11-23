import { renderHook, act } from '@testing-library/react';
import { useOffCallChimer } from './useOffCallChimer';
import * as offCallChime from '../utils/offCallChime';

jest.mock('../utils/offCallChime', () => {
  const actual = jest.requireActual('../utils/offCallChime');
  return {
    ...actual,
    playOffCallChime: jest.fn(() => ({ stop: jest.fn() })),
  };
});

describe('useOffCallChimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not chime when isActive is true and speech is active', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: true,
        isBreakActive: false,
        lastActivityTime: Date.now(),
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(30000); // 30s
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
  });

  test('chimes on mid-call silence (>60s) when not on hold', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: true,
        isBreakActive: false,
        isHold: false,
        lastActivityTime: Date.now() - 65000, // 65s of silence
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(offCallChime.playOffCallChime).toHaveBeenCalledTimes(1);
    const playedTune = offCallChime.playOffCallChime.mock.calls[0][0];
    expect(playedTune.id).toBe('call_silence');
  });

  test('mutes silence chimes when in active call and on hold <= 15m', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: true,
        isBreakActive: false,
        isHold: true,
        holdSeconds: 300, // 5 min on hold
        lastActivityTime: Date.now() - 300000,
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
  });

  test('chimes hold overtime when on hold > 15m (900s)', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: true,
        isBreakActive: false,
        isHold: true,
        holdSeconds: 965, // >15m
        lastActivityTime: Date.now() - 965000,
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(offCallChime.playOffCallChime).toHaveBeenCalledTimes(1);
    const playedTune = offCallChime.playOffCallChime.mock.calls[0][0];
    expect(playedTune.id).toBe('hold_overtime');
  });

  test('chimes every 60 seconds when off-call and enabled', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: false,
        isBreakActive: false,
        stats: { goalMinutes: 5500, monthlyMinutes: 5000 }, // ahead
      })
    );

    act(() => {
      jest.advanceTimersByTime(60000); // 1 minute
    });

    expect(offCallChime.playOffCallChime).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(60000); // 2 minutes
    });

    expect(offCallChime.playOffCallChime).toHaveBeenCalledTimes(2);
  });

  test('silences off-call idle chimes when isOnAvail is true', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: false,
        isBreakActive: false,
        isOnAvail: true,
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(120000); // 2 minutes
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
  });

  test('silences in-call silence chimes when isOnAvail is true during active call', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: true,
        isBreakActive: false,
        isOnAvail: true,
        isHold: false,
        lastActivityTime: Date.now() - 120000,
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(120000); // 2 minutes
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
  });

  test('silences chime during healthy break (breakLeft >= 15)', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: false,
        isBreakActive: true,
        stats: { dailyBreakMinutes: 20 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
  });

  test('chimes warning when break time is low (<15m)', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: false,
        isBreakActive: true,
        stats: { dailyBreakMinutes: 80 }, // 90 - 80 = 10m left
      })
    );

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(offCallChime.playOffCallChime).toHaveBeenCalledTimes(1);
    const playedTune = offCallChime.playOffCallChime.mock.calls[0][0];
    expect(playedTune.id).toBe('break_low');
  });

  test('toggleChime switches enabled state and persists', () => {
    const { result } = renderHook(() =>
      useOffCallChimer({
        isActive: false,
      })
    );

    expect(result.current.isChimeEnabled).toBe(true);

    act(() => {
      result.current.toggleChime(false);
    });

    expect(result.current.isChimeEnabled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
  });

  test('previewTune triggers chime directly', () => {
    const { result } = renderHook(() => useOffCallChimer({ isActive: true }));

    act(() => {
      result.current.previewTune('ahead');
    });

    expect(offCallChime.playOffCallChime).toHaveBeenCalledWith('ahead', expect.objectContaining({ force: true }));
  });
});
