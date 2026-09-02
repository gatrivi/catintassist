import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../contexts/AudioSettingsContext', () => ({
  useAudioSettings: () => ({
    inputDevices: [], outputDevices: [], selectedMicId: '', selectedSinkId: '',
    changeMicId: jest.fn(), changeSinkId: jest.fn(), fetchDevices: jest.fn(),
    micLevel: 0, micStatus: 'idle',
  }),
}));
jest.mock('../hooks/useAudioSource', () => ({
  useAudioSource: () => ({
    selectedInputDeviceId: '', refreshSelectedDeviceId: jest.fn(),
    refreshInputDevices: jest.fn(), switchAudioSourceMode: jest.fn(),
    currentSourceMode: 'tab',
  }),
}));
jest.mock('../utils/componentVisibility', () => ({
  isComponentVisible: () => false,
  useComponentVisibilityRefresh: () => {},
}));

import { AudioRouteStatusBar } from './AudioRouteStatusBar';

describe('AudioRouteStatusBar active-call source controls', () => {
  test('keeps TAB and VB visible in the compact active-call row', async () => {
    const onTab = jest.fn();
    const onVb = jest.fn();
    render(
      <AudioRouteStatusBar
        compact
        isActive
        configuredAudioSourceMode="tab"
        onSwitchToTabShare={onTab}
        onSwitchToVirtualCable={onVb}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'TAB' }));
    await userEvent.click(screen.getByRole('button', { name: 'VB' }));

    expect(onTab).toHaveBeenCalledTimes(1);
    expect(onVb).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /mic/i })).not.toBeInTheDocument();
  });
});
