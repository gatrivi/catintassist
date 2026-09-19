import React from 'react';
import { render, screen } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';

// v4.132.0: the MIC VERIFY chip left the off-call header row
// (#off-call-inline-row) and lives in Settings → Audio → Devices now. These
// cases render the REAL Audio section and assert the chip is there — the
// header-side assertions (chip gone off-call, kept on-call) live in
// DashboardHeader.test.js.
//
// Only the Audio section is rendered (initialSection='audio'), so the heavy
// panels of the other tabs are imported but never mounted. The contexts below
// are mocked so no provider tree is needed.

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    translationMood: 'auto',
    setTranslationMood: jest.fn(),
    speechAutoConnect: false,
    setSpeechAutoConnect: jest.fn(),
    isNotesOpen: false,
    setIsNotesOpen: jest.fn(),
    vaultStatus: 'idle',
    autoAttachEnabled: false,
    setAutoAttachEnabled: jest.fn(),
  }),
}));

jest.mock('../contexts/AudioSettingsContext', () => ({
  useAudioSettings: () => ({
    inputDevices: [],
    outputDevices: [],
    selectedMicId: '',
    selectedSinkId: '',
    selectedRecMicId: '',
    changeMicId: jest.fn(),
    changeSinkId: jest.fn(),
    changeRecMicId: jest.fn(),
    fetchDevices: jest.fn(),
  }),
}));

jest.mock('../hooks/useAudioSource', () => ({
  useAudioSource: () => ({
    currentSourceMode: 'tab',
    switchAudioSourceMode: jest.fn(),
    availableInputDevices: [],
    selectedInputDeviceId: '',
    refreshInputDevices: jest.fn(),
    refreshSelectedDeviceId: jest.fn(),
  }),
}));

jest.mock('../hooks/useTTS', () => ({ useTTS: () => ({ playTTS: jest.fn() }) }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const renderAudioSection = () =>
  render(<SettingsPanel open onClose={jest.fn()} initialSection="audio" />);

const seedMicVerdict = () => {
  localStorage.setItem(
    'CATINTASSIST_MIC_VERIFY_LAST',
    JSON.stringify({ tone: 'pass', label: 'CABLE Output (VB-Audio)', at: Date.UTC(2026, 8, 17, 12, 0, 0) }),
  );
};

describe('SettingsPanel → Audio: MIC VERIFY chip (v4.132.0)', () => {
  afterEach(() => localStorage.clear());

  test('renders the chip next to the mic selectors once a verdict exists', () => {
    seedMicVerdict();
    renderAudioSection();

    // The labelled row is inside the Devices/mic area of the Audio section.
    expect(screen.getByText(/Client mic — last MIC VERIFY verdict/)).toBeInTheDocument();
    const chip = document.querySelector('.mic-verify-chip');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('CABLE Output');
  });

  test('empty state: chip no-ops, label + idle-pane hint stay so the row reads', () => {
    renderAudioSection();

    expect(document.querySelector('.mic-verify-chip')).toBeNull();
    // Label stays on purpose: the row explains where the verdict comes from
    // instead of silently vanishing (the chip itself returns null).
    expect(screen.getByText(/Client mic — last MIC VERIFY verdict/)).toBeInTheDocument();
    expect(screen.getByText(/Full MIC VERIFY panel stays in the idle pane/)).toBeInTheDocument();
  });
});
