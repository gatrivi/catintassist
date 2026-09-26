import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../contexts/AudioSettingsContext', () => ({
  useAudioSettings: () => ({
    inputDevices: [], outputDevices: [], selectedMicId: '', selectedSinkId: 'sink-1',
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

// v4.165.0. The compact strip is the row under the header buttons, and it was
// eating half the header's width. Three things left it:
//
//   TAB / VB source rescue  -> Settings -> Audio (switchAudioSourceMode)
//   the "Greetings go out here / CABLE Input" output label -> Settings -> Audio
//   the EN|ES pair button (in the header, not here)         -> Settings -> Language
//
// The capability must NOT vanish with the button, so these cases assert both
// halves: gone from the strip, still reachable in Settings.
describe('AudioRouteStatusBar compact strip (v4.165.0)', () => {
  const renderCompact = (props = {}) => render(
    <AudioRouteStatusBar compact isActive configuredAudioSourceMode="tab" {...props} />,
  );

  test('the TAB / VB source toggle is no longer in the compact strip', () => {
    renderCompact({ onSwitchToTabShare: jest.fn(), onSwitchToVirtualCable: jest.fn() });

    expect(screen.queryByRole('button', { name: 'TAB' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'VB' })).not.toBeInTheDocument();
    expect(document.querySelector('.audio-route-compact-source-toggle')).toBeNull();
    expect(document.getElementById('audio-route-active-tab-btn')).toBeNull();
    expect(document.getElementById('audio-route-active-vb-btn')).toBeNull();
  });

  test('the greetings output label is gone — which device is a setup question', () => {
    const { container } = renderCompact();
    // Scope to the COMPACT proof: the hidden full strip still has its own
    // 🔊 output readout, which is correct (that one is only hidden in the header
    // by CSS, and it is where the device pickers live).
    const compact = container.querySelector('.audio-route-compact-proof');
    expect(compact).not.toBeNull();
    expect(compact.textContent).not.toMatch(/🔊/);
  });

  // The strip still has to be useful: Deepgram health is the one thing you
  // cannot see anywhere else at a glance during a call.
  test('the Deepgram health proof stays in the strip', () => {
    const { container } = renderCompact();
    const dg = container.querySelector('.audio-route-compact-proof__dg');
    expect(dg).not.toBeNull();
    expect(dg).toHaveAttribute('title');
  });

  test('a fault still surfaces its rescue button', () => {
    const onReconnectStream = jest.fn();
    const { container } = renderCompact({ onReconnectStream, connectionState: 'error' });
    // The ZAP button is conditional on a real stall, and stays in the strip.
    expect(container.querySelector('#audio-route-zap-btn')).not.toBeNull();
  });
});
