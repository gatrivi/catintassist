import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GreetingsPanel } from './GreetingsPanel';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { generateObjectUrl, getStorageSummary, loadFile } from '../utils/storage';
import { bindAudioToSink } from '../utils/audioRoute';
import { capSinkTestVolume } from '../utils/audioSelfTest';

jest.mock('../contexts/AudioSettingsContext', () => ({ useAudioSettings: jest.fn() }));
jest.mock('../utils/storage');
jest.mock('../utils/audioRoute', () => ({
  bindAudioToSink: jest.fn().mockResolvedValue(true),
  primePlaybackElements: jest.fn(),
  rampVolume: jest.fn(),
}));
jest.mock('./AudioEditorPanel', () => () => null);

describe('soundboard recording playback buttons', () => {
  let settings;
  let recording;
  let mediaPlay;
  let originalAudioContext;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Keep the real route preference/default: shared selected-output playback.
    recording = new Blob(['recorded greeting'], { type: 'audio/webm' });
    recording.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(4));
    loadFile.mockImplementation(async (key) => key === 'intake' ? recording : null);
    generateObjectUrl.mockReturnValue('blob:saved-intake');
    getStorageSummary.mockResolvedValue({ keyCount: 1, bytes: recording.size, keys: ['intake'] });
    originalAudioContext = window.AudioContext;
    window.AudioContext = jest.fn(() => ({
      decodeAudioData: jest.fn().mockResolvedValue({
        getChannelData: () => new Float32Array(112).fill(0.25),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }));
    mediaPlay = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    settings = {
      selectedSinkId: 'voicemeeter-in-1',
      selectedMicId: '',
      selectedRecMicId: 'realtek-recording-mic',
      outputDevices: [{ deviceId: 'voicemeeter-in-1', label: 'Voicemeeter In 1 (VB-Audio)' }],
      inputDevices: [],
      localVolume: 0.7,
      sinkVolume: 0.9,
      changeLocalVolume: jest.fn(),
      changeSinkVolume: jest.fn(),
      monitorMic: false,
      setMonitorMic: jest.fn(),
      monitorVolume: 0.5,
      setMonitorVolume: jest.fn(),
      setSinkPlaybackActive: jest.fn(),
      sinkPlaybackActive: false,
      playClipToSink: jest.fn().mockResolvedValue({ ok: true }),
      stopClipToSink: jest.fn(),
    };
    useAudioSettings.mockReturnValue(settings);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.AudioContext = originalAudioContext;
    delete window.__CAT_AUDIO_VOL;
  });

  const openSavedRecording = async (micTestMode) => {
    render(<GreetingsPanel micTestMode={micTestMode} />);
    // Follow the user's actual path: Soundboard > Setup > saved recording.
    await screen.findByRole('button', { name: 'Intake Qs' });
    fireEvent.click(screen.getByTitle('Record / upload clips'));
    fireEvent.click(screen.getByRole('button', { name: /Intake Qs/ }));
    await screen.findByText('SAVED');
  };

  test.each([true, false])('Caller sends the saved clip to the selected output with mic mode %s', async (micTestMode) => {
    await openSavedRecording(micTestMode);
    fireEvent.click(screen.getByRole('button', { name: /Caller/ }));

    await waitFor(() => expect(settings.playClipToSink).toHaveBeenCalledWith(
      recording,
      capSinkTestVolume(settings.sinkVolume),
      expect.objectContaining({ clipKey: 'intake', onProgress: expect.any(Function) }),
    ));
    expect(bindAudioToSink).toHaveBeenCalledWith(expect.any(HTMLAudioElement), 'voicemeeter-in-1');
    expect(mediaPlay).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Yes, mark CALL OK' })).toBeInTheDocument();
  });

  test.each([true, false])('You remains local with mic mode %s', async (micTestMode) => {
    await openSavedRecording(micTestMode);
    fireEvent.click(screen.getByRole('button', { name: /You/ }));

    await waitFor(() => expect(mediaPlay).toHaveBeenCalledTimes(1));
    expect(mediaPlay.mock.instances[0].src).toBe('blob:saved-intake');
    expect(settings.playClipToSink).not.toHaveBeenCalled();
    expect(settings.setSinkPlaybackActive).not.toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Yes, mark CALL OK' })).not.toBeInTheDocument();
  });

  test('soundcheck opens the saved fallback recording rather than the empty current slot', async () => {
    const hour = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
    loadFile.mockImplementation(async (key) => key === 'greeting_en_morning' ? recording : null);
    const onOpen = jest.fn();
    window.addEventListener('cat_open_greeting_editor', onOpen);
    try {
      render(<GreetingsPanel />);
      // v4.131.0: the empty opener card is a <button> too, so /Opener – Client/ matches it
      // as well — wait until the saved clip has loaded (empty card gone) before clicking.
      await waitFor(() => expect(
        screen.queryByRole('button', { name: /Opener – Client not recorded/ }),
      ).not.toBeInTheDocument());
      expect(await screen.findByRole('button', { name: /Opener – Client/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Sound check/ }));
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0][0].detail.clipKey).toBe('greeting_en_morning');
      expect(settings.playClipToSink).not.toHaveBeenCalled();
      expect(mediaPlay).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('cat_open_greeting_editor', onOpen);
      hour.mockRestore();
    }
  });

  test('an ordinary tile stays local in mic mode', async () => {
    render(<GreetingsPanel micTestMode />);
    fireEvent.click(await screen.findByRole('button', { name: 'Intake Qs' }));

    await waitFor(() => expect(mediaPlay).toHaveBeenCalledTimes(1));
    expect(settings.playClipToSink).not.toHaveBeenCalled();
    expect(settings.setSinkPlaybackActive).not.toHaveBeenCalledWith(true);
  });

  test('Caller cannot silently use the default output when no greeting output is selected', async () => {
    settings.selectedSinkId = '';
    await openSavedRecording(true);
    expect(screen.getByRole('button', { name: /Caller/ })).toBeDisabled();
    expect(settings.playClipToSink).not.toHaveBeenCalled();
  });
});

describe('v4.131.0 studio soundcheck line', () => {
  let settings;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    loadFile.mockImplementation(async () => null);
    generateObjectUrl.mockReturnValue('blob:x');
    getStorageSummary.mockResolvedValue({ keyCount: 0, bytes: 0, keys: [] });
    settings = {
      selectedSinkId: 'voicemeeter-in-1',
      selectedMicId: '',
      selectedRecMicId: '',
      outputDevices: [{ deviceId: 'voicemeeter-in-1', label: 'Voicemeeter In 1 (VB-Audio)' }],
      inputDevices: [],
      localVolume: 0.7,
      sinkVolume: 0.9,
      changeLocalVolume: jest.fn(),
      changeSinkVolume: jest.fn(),
      monitorMic: false,
      setMonitorMic: jest.fn(),
      monitorVolume: 0.5,
      setMonitorVolume: jest.fn(),
      setSinkPlaybackActive: jest.fn(),
      sinkPlaybackActive: false,
      playClipToSink: jest.fn().mockResolvedValue({ ok: true }),
      stopClipToSink: jest.fn(),
    };
    useAudioSettings.mockReturnValue(settings);
  });

  test('studio is one status line with a soundcheck entry to the Editor view', async () => {
    render(<GreetingsPanel micTestMode={false} />);
    expect(await screen.findByText(/Greetings ·/)).toBeInTheDocument();
    expect(screen.getByText(/EN needs a clip/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sound check/ })).toBeInTheDocument();
    // v4.131.0: the vestigial "Labels" checkbox is gone — only the Size slider remains.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // The old wall of text is gone from Studio.
    expect(screen.queryByText(/Test before call:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Auto-picked from the clock/)).not.toBeInTheDocument();
  });

  test('soundcheck button opens the Greeting Editor view for the missing clip', async () => {
    const openSpy = jest.fn();
    window.addEventListener('cat_open_greeting_editor', openSpy);
    try {
      render(<GreetingsPanel micTestMode={false} />);
      fireEvent.click(await screen.findByRole('button', { name: /Sound check/ }));
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0].detail.clipKey).toMatch(/^greeting_(en|es)_/);
    } finally {
      window.removeEventListener('cat_open_greeting_editor', openSpy);
    }
  });

  // v4.131.0: the pill must spell out its claim (EN + ES, current slot, caller-tested).
  test('CALL READY pill states exactly what it means', async () => {
    const hour = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
    const clip = new Blob(['greeting'], { type: 'audio/webm' });
    localStorage.setItem('catint_manual_call_ok_v1', JSON.stringify({
      'greeting_en|voicemeeter-in-1|': { at: 1, clipKey: 'greeting_en_morning', sinkId: 'voicemeeter-in-1', micId: '' },
      'greeting_es|voicemeeter-in-1|': { at: 1, clipKey: 'greeting_es_morning', sinkId: 'voicemeeter-in-1', micId: '' },
    }));
    loadFile.mockImplementation(async (key) => (
      key === 'greeting_en_morning' || key === 'greeting_es_morning' ? clip : null
    ));
    try {
      render(<GreetingsPanel micTestMode={false} />);
      const pill = await screen.findByText('CALL READY');
      expect(pill).toHaveAttribute('title', 'EN and ES greetings for this slot have a passing caller test (CALL OK)');
    } finally {
      hour.mockRestore();
    }
  });

  // v4.131.0: the whole empty card opens Setup — one interactive element, no nested button.
  test('an unrecorded card is one button that opens Setup', async () => {
    render(<GreetingsPanel micTestMode={false} />);
    const card = await screen.findByRole('button', { name: 'Intake Qs not recorded - open Setup to record' });
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(card);
    // Setup view took over — its disk-backup hint is Setup-only.
    expect(await screen.findByText(/disk backup/)).toBeInTheDocument();
  });
});
