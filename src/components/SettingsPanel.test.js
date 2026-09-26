import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';

// v4.132.0: the MIC VERIFY chip left the off-call header row
// (#off-call-inline-row) and lives in Settings → Audio → Devices now. These
// cases render the REAL Audio section and assert the chip is there — the
// header-side assertions (chip gone off-call, kept on-call) live in
// DashboardHeader.test.js.
//
// Only the section under test is rendered (initialSection='audio'), so the heavy
// panels of the other tabs are imported but never mounted. The contexts below
// are mocked so no provider tree is needed.

let mockSessionState = {};
// v4.161.0 — the drawer grew a real nav (search / groups / pins / deep links),
// so the session stub has to be drivable: in-call, off-call, and "signed in".
const setSession = (over = {}) => {
  mockSessionState = {
    translationMood: 'auto',
    setTranslationMood: jest.fn(),
    speechAutoConnect: false,
    setSpeechAutoConnect: jest.fn(),
    isNotesOpen: false,
    setIsNotesOpen: jest.fn(),
    vaultStatus: 'idle',
    autoAttachEnabled: false,
    setAutoAttachEnabled: jest.fn(),
    isActive: false,
    isZombieCall: false,
    ...over,
  };
};
setSession();

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => mockSessionState,
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

const renderDeepgramSection = () =>
  render(<SettingsPanel open onClose={jest.fn()} initialSection="deepgram" />);

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
    expect(screen.getByText(/Client mic — last MIC VERIFY verdict/)).toBeInTheDocument();
    expect(screen.getByText(/Full MIC VERIFY panel stays in the idle pane/)).toBeInTheDocument();
  });

  test('admin STT trace and audio ring default off and toggle explicitly', () => {
    renderAudioSection();
    const trace = screen.getByRole('button', { name: /Trace: OFF/i });
    const audio = screen.getByRole('button', { name: /Last 60s audio: OFF/i });
    expect(trace).toHaveAttribute('aria-pressed', 'false');
    expect(audio).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(trace);
    fireEvent.click(audio);

    expect(screen.getByRole('button', { name: /Trace: ON/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Last 60s audio: ON/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// v4.157.0 — the four transcription safety switches, all OFF until the operator
// says otherwise. The "off = today's behaviour" promise lives here, in the place
// the operator actually touches.
describe('SettingsPanel -> Deepgram: guards + provider biasing (v4.157.0)', () => {
  afterEach(() => localStorage.clear());

  test('every switch starts OFF', () => {
    renderDeepgramSection();
    expect(screen.getByRole('button', { name: /Term repair: OFF/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Negation guard: OFF/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Medical model \(EN\): OFF/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Keyterm bias: OFF/i })).toHaveAttribute('aria-pressed', 'false');
  });

  test('each switch flips on its own and persists', () => {
    renderDeepgramSection();

    fireEvent.click(screen.getByRole('button', { name: /Term repair: OFF/i }));
    expect(screen.getByRole('button', { name: /Term repair: ON/i })).toHaveAttribute('aria-pressed', 'true');
    // the safe read-only guard must not have come along for the ride
    expect(screen.getByRole('button', { name: /Negation guard: OFF/i })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: /Keyterm bias: OFF/i }));
    expect(screen.getByRole('button', { name: /Keyterm bias: ON/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Medical model \(EN\): OFF/i })).toHaveAttribute('aria-pressed', 'false');
  });

  test('the cost warning is on the panel, not hidden in a doc', () => {
    renderDeepgramSection();
    expect(screen.getByText(/2x the EN price/i)).toBeInTheDocument();
  });
});

// v4.161.0 — "I get lost in them hard to find what I want". The nav is now a
// registry: grouped, searchable, pinnable, and it reopens where you left off.
describe('SettingsPanel -> navigation (v4.161.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSession();
  });
  afterEach(() => localStorage.clear());

  const renderNav = () => render(<SettingsPanel open onClose={jest.fn()} />);

  test('panels are grouped and each row says what it is for', () => {
    renderNav();
    ['Today', 'Speech', 'Output', 'App'].forEach((g) => {
      expect(screen.getByText(g)).toBeInTheDocument();
    });
    expect(screen.getByText('Correct the day from the company call log')).toBeInTheDocument();
    expect(screen.getByText('STT model, latency, clinical guards, keyterms')).toBeInTheDocument();
  });

  test('a pinned panel is listed once, not twice on one screen', () => {
    renderNav();
    // "Today" is pinned by default and also belongs to the Today group.
    expect(screen.getAllByText('Correct the day from the company call log')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Unpin Call log' })).toHaveLength(1);
    // It lives in the pinned strip, so it is not repeated under its group.
    expect(screen.getAllByText('Call log')).toHaveLength(1);
  });

  test('search finds the call-log panel from the words the operator uses', () => {
    renderNav();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'minutes' } });

    const results = document.querySelectorAll('.settings-nav-btn');
    expect(results).toHaveLength(1);
    expect(results[0].textContent).toContain('Call log');
    // Groups collapse while searching so the answer is not buried.
    expect(screen.queryByText('Speech')).toBeNull();
  });

  test('a search with no answer says so instead of showing an empty drawer', () => {
    renderNav();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'zzzqqq' } });
    expect(screen.getByText(/Nothing matches/i)).toBeInTheDocument();
  });

  test('picking a search result opens that panel', () => {
    renderNav();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'theme' } });
    fireEvent.click(screen.getByText('Theme, colours, what is visible').closest('button'));
    expect(screen.getByText(/Theme palette/)).toBeInTheDocument();
  });

  test('the daily tool is pinned by default and a pin can be added', () => {
    const { unmount } = renderNav();
    expect(screen.getByRole('button', { name: 'Unpin Call log' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Pin Audio' }));
    expect(screen.getByRole('button', { name: 'Unpin Audio' })).toHaveAttribute('aria-pressed', 'true');
    // survives a reload — the pin is read back from storage
    unmount();
    renderNav();
    expect(screen.getByRole('button', { name: 'Unpin Audio' })).toBeInTheDocument();
  });

  test('reopening with no target returns to the last panel used, not Deepgram', () => {
    const { unmount } = renderNav();
    fireEvent.click(screen.getByText('Theme, colours, what is visible').closest('button'));
    expect(screen.getByText(/Theme palette/)).toBeInTheDocument();
    unmount();

    render(<SettingsPanel open onClose={jest.fn()} />);
    expect(screen.getByText(/Theme palette/)).toBeInTheDocument();
  });

  test('an explicit target still wins over the remembered panel', () => {
    localStorage.setItem('catint_settings_last_section_v1', '"display"');
    render(<SettingsPanel open onClose={jest.fn()} initialSection="language" />);
    expect(screen.getByText(/Left column \(patient\)/)).toBeInTheDocument();
  });

  // The goal wheel is the feature the operator loves, and until now it was
  // reachable only from a handful of header buttons. Settings is the one place
  // they go looking, so it has to live here too.
  test('Goals is findable by the words an operator uses for it', () => {
    renderNav();
    ['goal', 'target', 'how much do i need'].forEach((q) => {
      fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: q } });
      const first = document.querySelector('.settings-nav-btn');
      expect(first?.textContent).toContain('Goals');
    });
  });

  test('Goals deep-links into the wheel and closes the drawer', () => {
    const onClose = jest.fn();
    const onOpen = jest.fn();
    window.addEventListener('cat_open_goals_view', onOpen);
    render(<SettingsPanel open onClose={onClose} />);

    fireEvent.click(screen.getByText('Set how much you need per day / week / month').closest('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener('cat_open_goals_view', onOpen);
  });

  test('mid-call, Goals says it is off-call only instead of doing nothing', () => {
    setSession({ isActive: true });
    const onClose = jest.fn();
    const onOpen = jest.fn();
    window.addEventListener('cat_open_goals_view', onOpen);
    render(<SettingsPanel open onClose={onClose} />);

    expect(screen.getByText('off-call only')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Set how much you need per day / week / month').closest('button'));

    expect(onOpen).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/The goal wheel is off-call only/i)).toBeInTheDocument();
    window.removeEventListener('cat_open_goals_view', onOpen);
  });
});
