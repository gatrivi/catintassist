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

  test('does not chime when isActive is true', () => {
    renderHook(() =>
      useOffCallChimer({
        isActive: true,
        isBreakActive: false,
        stats: { goalMinutes: 5500, monthlyMinutes: 1000 },
      })
    );

    act(() => {
      jest.advanceTimersByTime(120000); // 2 minutes
    });

    expect(offCallChime.playOffCallChime).not.toHaveBeenCalled();
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

  test('chimes with break tune when isBreakActive is true', () => {
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

    expect(offCallChime.playOffCallChime).toHaveBeenCalledTimes(1);
    const playedTune = offCallChime.playOffCallChime.mock.calls[0][0];
    expect(playedTune.id).toBe('break_healthy');
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
