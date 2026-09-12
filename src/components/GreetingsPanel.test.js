import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
