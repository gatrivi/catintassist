import { act, renderHook } from '@testing-library/react';
import { useTTS } from './useTTS';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { bindAudioToSink } from '../utils/audioRoute';

jest.mock('../contexts/AudioSettingsContext', () => ({ useAudioSettings: jest.fn() }));
jest.mock('../utils/audioRoute', () => ({ bindAudioToSink: jest.fn(), primePlaybackElements: jest.fn() }));
jest.mock('../utils/micMode', () => ({ readMicTestMode: () => false }));
jest.mock('../utils/audioSelfTest', () => ({ isLocalOnlyPlayback: () => false }));
jest.mock('../utils/routeDiagnostics', () => ({
  ...jest.requireActual('../utils/routeDiagnostics'), logRouteEvent: jest.fn(),
}));

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
let settings;
let elements;
let originalFetch;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  settings = {
    selectedSinkId: 'voicemeeter', localVolume: 0.3, sinkVolume: 0.4,
    playClipToSink: jest.fn(), stopClipToSink: jest.fn(), setSinkPlaybackActive: jest.fn(),
  };
  useAudioSettings.mockImplementation(() => settings);
  elements = [];
  jest.spyOn(window, 'Audio').mockImplementation(() => {
    const element = { play: jest.fn().mockResolvedValue(), pause: jest.fn() };
    elements.push(element);
    return element;
  });
  originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ blob: async () => new Blob(['voice']) });
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

test.each(['sink_changed', 'play_cancelled'])('cancelled TTS (%s) never starts dual output or delayed local audio', async (reason) => {
  const pending = deferred();
  settings.playClipToSink.mockReturnValue(pending.promise);
  const { result } = renderHook(useTTS);
  let playback;
  await act(async () => { playback = result.current.playTTS('Hello', 'en', 'blob:voice'); await flush(); });
  expect(settings.playClipToSink).toHaveBeenCalledTimes(1);
  const stopCalls = settings.stopClipToSink.mock.calls.length;
  await act(async () => { pending.resolve({ ok: false, cancelled: true, reason }); await playback; });
  expect(bindAudioToSink).not.toHaveBeenCalled();
  expect(elements).toHaveLength(2);
  elements.forEach((element) => expect(element.play).not.toHaveBeenCalled());
  expect(result.current.isPlaying).toBe(false);
  expect(result.current.playingUrl).toBe(null);
  expect(settings.stopClipToSink).toHaveBeenCalledTimes(stopCalls);
});

test('Stop while fetching TTS prevents the completed fetch from starting sink playback', async () => {
  const fetching = deferred();
  global.fetch.mockReturnValue(fetching.promise);
  const { result } = renderHook(useTTS);
  let playback;
  await act(async () => { playback = result.current.playTTS('Hello', 'en', 'blob:voice'); await flush(); });
  act(() => result.current.stopTTS());
  await act(async () => { fetching.resolve({ blob: async () => new Blob(['voice']) }); await playback; });
  expect(settings.playClipToSink).not.toHaveBeenCalled();
  expect(bindAudioToSink).not.toHaveBeenCalled();
  expect(result.current.isPlaying).toBe(false);
});

test('late cancellation of old TTS does not clear a newer request', async () => {
  const older = deferred();
  const newer = deferred();
  settings.playClipToSink.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const { result, rerender } = renderHook(useTTS);
  let first;
  let second;
  await act(async () => { first = result.current.playTTS('Hello', 'en', 'blob:old'); await flush(); });
  settings.selectedSinkId = 'new-output';
  rerender();
  await act(async () => { second = result.current.playTTS('Again', 'en', 'blob:new'); await flush(); });
  await act(async () => { older.resolve({ ok: false, cancelled: true, reason: 'sink_changed' }); await first; });
  expect(result.current.isPlaying).toBe(true);
  expect(result.current.playingUrl).toBe('blob:new');
  expect(bindAudioToSink).not.toHaveBeenCalled();
  await act(async () => {
    result.current.stopTTS();
    newer.resolve({ ok: false, cancelled: true, reason: 'play_cancelled' });
    await second;
  });
});
