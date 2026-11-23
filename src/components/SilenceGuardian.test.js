import React from 'react';
import { render } from '@testing-library/react';
import { SilenceGuardian } from './SilenceGuardian';

const mockUseSession = jest.fn();
jest.mock('../contexts/SessionContext', () => ({
  useSession: () => mockUseSession(),
  safeSet: jest.fn(),
}));

const mockAudioEngine = {
  playWarningTiered: jest.fn(),
  playWarningPing: jest.fn(),
};
jest.mock('../hooks/useProgressiveAudio', () => ({
  useProgressiveAudio: () => mockAudioEngine,
}));

describe('SilenceGuardian', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not warn or disconnect when isOnAvail is true', () => {
    mockUseSession.mockReturnValue({
      isActive: true,
      lastActivityTime: Date.now() - 500000, // 500s silence
      stopSession: jest.fn(),
      startBreak: jest.fn(),
      isHold: false,
      isOnAvail: true,
    });

    render(<SilenceGuardian lastDataTime={Date.now()} onStopAudio={jest.fn()} connectionState="connected" />);

    jest.advanceTimersByTime(10000);

    expect(mockAudioEngine.playWarningTiered).not.toHaveBeenCalled();
    expect(mockAudioEngine.playWarningPing).not.toHaveBeenCalled();
  });
});
