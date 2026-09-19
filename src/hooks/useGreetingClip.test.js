// Regression coverage for v4.115.0; all paid/audio APIs are mocked.

import { act, renderHook, waitFor } from '@testing-library/react';
import { useGreetingClip, useGreetingRecorder, analyzeClipAudio } from './useGreetingClip';
import { loadFile, saveFile, deleteFile, listStorageKeys, loadRawValue } from '../utils/storage';
import { getEffectiveDeepgramKey } from '../utils/deepgramRuntimeKey';
import { getScriptForClip } from '../services/soundboardMetaService';
import { analyzeClipLegibility } from '../utils/audioSelfTest';

jest.mock('../utils/storage');
jest.mock('../utils/deepgramRuntimeKey');
jest.mock('../services/soundboardMetaService', () => ({ getScriptForClip: jest.fn() }));
jest.mock('../utils/audioSelfTest', () => ({ analyzeClipLegibility: jest.fn() }));

const key = 'greeting_en_morning';
const blob = () => new Blob(['voice'], { type: 'audio/webm' });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const read = (name) => JSON.parse(localStorage.getItem(name) || '{}');
const cacheKeys = ['catint_audio_health', 'catint_audio_health_heard', 'catint_loudness', 'catint_sb_chop'];
let files;
beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  files = { [key]: blob() };
  listStorageKeys.mockImplementation(async () => Object.keys(files));
  loadFile.mockImplementation(async (k) => files[k] || null);
  saveFile.mockImplementation(async (k, b) => { files[k] = b; return true; });
  deleteFile.mockImplementation(async (k) => { delete files[k]; return true; });
  getEffectiveDeepgramKey.mockReturnValue('configured-key');
  getScriptForClip.mockReturnValue('Good morning');
  analyzeClipLegibility.mockResolvedValue({ score: 0.9, transcript: 'Good morning', recall: 1, confidence: 0.9 });
});
afterEach(() => jest.restoreAllMocks());
const clips = async () => {
  const view = renderHook(() => useGreetingClip());
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
};

describe('clip storage and explicit health', () => {
  test('uses the actual key/script/probe APIs and compatible cache shapes', async () => {
    const { result } = await clips();
    expect(analyzeClipLegibility).not.toHaveBeenCalled();
    await act(async () => expect(await result.current.analyzeHealth(key)).toBe(true));
    expect(analyzeClipLegibility).toHaveBeenCalledWith(files[key], 'configured-key', 'Good morning');
    expect(read(cacheKeys[0])[key]).toBe(0.9);
    expect(read(cacheKeys[1])[key]).toEqual({ text: 'Good morning', recall: 1, confidence: 0.9, at: expect.any(Number) });
  });

  test.each(['uploadFile', 'clearClip'])('%s clears proofs and does not auto-probe', async (method) => {
    cacheKeys.forEach((name) => localStorage.setItem(name, JSON.stringify({ [key]: 0.99, other: 0.8 })));
    const proofs = { 'greeting_en|sink|mic': true, 'greeting_en_evening|s2|m2': true, 'greeting_es|sink|mic': true };
    ['catint_manual_call_ok_v1', 'catint_call_path_verified'].forEach((name) => localStorage.setItem(name, JSON.stringify(proofs)));
    const event = jest.fn();
    window.addEventListener('catint_gates_updated', event);
    const { result } = await clips();
    await act(async () => expect(await result.current[method](key, blob())).toBe(true));
    cacheKeys.forEach((name) => expect(read(name)).toEqual({ other: 0.8 }));
    ['catint_manual_call_ok_v1', 'catint_call_path_verified'].forEach((name) => expect(read(name)).toEqual({ 'greeting_es|sink|mic': true }));
    expect(result.current.healthScores[key]).toBeUndefined();
    expect(result.current.heardByRobot[key]).toBeUndefined();
    expect(analyzeClipLegibility).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalled();
    window.removeEventListener('catint_gates_updated', event);
  });

  test.each(['uploadFile', 'clearClip'])('ignores delayed probe result after %s', async (method) => {
    const pending = deferred();
    analyzeClipLegibility.mockReturnValue(pending.promise);
    const { result } = await clips();
    let probe;
    act(() => { probe = result.current.analyzeHealth(key); });
    await waitFor(() => expect(analyzeClipLegibility).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current[method](key, blob()); });
    await act(async () => { pending.resolve({ score: 1 }); await probe; });
    expect(result.current.healthScores[key]).toBeUndefined();
    expect(read(cacheKeys[0])[key]).toBeUndefined();
    expect(result.current.isAnalyzing).toBeNull();
  });

  test('locks probes before loadFile and cancels before paid request on unmount', async () => {
    const { result, unmount } = await clips();
    const pending = deferred();
    loadFile.mockReturnValue(pending.promise);
    let probe;
    act(() => { probe = result.current.analyzeHealth(key); result.current.analyzeHealth(key); });
    expect(result.current.isAnalyzing).toBe(key);
    unmount();
    await act(async () => { pending.resolve(blob()); await probe; });
    expect(analyzeClipLegibility).not.toHaveBeenCalled();
  });
});

describe('recorder lifecycle', () => {
  beforeEach(() => setupRecorder());

  test('locks permission wait; late stream after unmount is stopped without recording/saving', async () => {
    const pending = deferred();
    navigator.mediaDevices.getUserMedia.mockReturnValue(pending.promise);
    const { result, unmount } = recordHook();
    let recording;
    act(() => { recording = result.current.startRecording(key); result.current.startRecording('other'); });
    expect(result.current.busy).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { pending.resolve(stream); await recording; });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(window.MediaRecorder).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('unmount discards active recording and queued stop event', async () => {
    const { result, unmount } = recordHook();
    await start(result);
    const queuedStop = recorder.onstop;
    unmount();
    await act(async () => { await queuedStop(); });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('explicit stop releases immediately, saves once, locks until save settles', async () => {
    const saving = deferred();
    onSaved.mockReturnValue(saving.promise);
    const { result } = recordHook();
    await start(result);
    act(() => { result.current.stopRecording(); result.current.stopRecording(); });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    let stopped;
    act(() => { stopped = deliverStop(); });
    await start(result);
    expect(window.MediaRecorder).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(key, expect.any(Blob));
    expect(result.current.busy).toBe(true);
    await act(async () => { saving.resolve(true); await stopped; });
    expect(result.current.busy).toBe(false);
  });

  test.each(['constructor', 'context', 'start', 'event', 'stop'])('%s failure releases resources and reports error', async (stage) => {
    const { result } = recordHook();
    if (stage === 'constructor') window.MediaRecorder.mockImplementation(() => { throw new Error('constructor'); });
    if (stage === 'context') ctx.createAnalyser.mockImplementation(() => { throw new Error('context'); });
    if (stage === 'start') recorder.start.mockImplementation(() => { throw new Error('start'); });
    await start(result);
    if (stage === 'event') act(() => recorder.onerror({ error: new Error('event') }));
    if (stage === 'stop') {
      recorder.stop.mockImplementation(() => { throw new Error('stop'); });
      act(() => result.current.stopRecording());
    }
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(stage === 'constructor' ? 0 : 1);
    expect(result.current.error).toContain(stage);
    expect(result.current.busy).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test.each(['false', 'reject'])('save %s reports non-alert error', async (outcome) => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    if (outcome === 'false') onSaved.mockResolvedValue(false);
    else onSaved.mockRejectedValue(new Error('save rejected'));
    const { result } = recordHook();
    await start(result);
    act(() => result.current.stopRecording());
    await act(deliverStop);
    expect(result.current.error).toMatch(/save/);
    expect(result.current.busy).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  test('falls back for missing selected mic, retaining raw constraints', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NotFoundError' }));
    const { result } = recordHook({ selectedRecMicId: 'dedicated', selectedMicId: 'call' });
    await start(result);
    expect(navigator.mediaDevices.getUserMedia.mock.calls).toEqual([
      [{ audio: { deviceId: { exact: 'dedicated' }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }],
      [{ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }],
    ]);
  });

  test('does not reprompt denied permission or fallback after unmount', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('Denied'), { name: 'NotAllowedError' }));
    const { result, unmount } = recordHook({ selectedMicId: 'call' });
    await start(result);
    expect(result.current.error).toContain('Denied');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    const pending = deferred();
    navigator.mediaDevices.getUserMedia.mockReturnValue(pending.promise);
    let recording;
    act(() => { recording = result.current.startRecording(key); });
    unmount();
    await act(async () => { pending.reject(Object.assign(new Error('missing'), { name: 'NotFoundError' })); await recording; });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  });
});


describe('visible failures', () => {
  test.each(['missing key', 'missing blob', 'rejected probe', 'null probe'])('%s clears busy and reports error', async (failure) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = await clips();
    if (failure === 'missing key') getEffectiveDeepgramKey.mockReturnValue(null);
    if (failure === 'missing blob') loadFile.mockResolvedValue(null);
    if (failure === 'rejected probe') analyzeClipLegibility.mockRejectedValue(new Error('Network failed'));
    if (failure === 'null probe') analyzeClipLegibility.mockResolvedValue(null);
    await act(async () => expect(await result.current.analyzeHealth(key)).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.isAnalyzing).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  test.each(['uploadFile', 'clearClip'])('%s honors false storage return and exposes write busy', async (method) => {
    const { result } = await clips();
    const pending = deferred();
    (method === 'uploadFile' ? saveFile : deleteFile).mockReturnValue(pending.promise);
    let writing;
    act(() => { writing = result.current[method](key, blob()); });
    expect(result.current.isSaving).toBe(key);
    expect(result.current.busy).toBe(true);
    await act(async () => { pending.resolve(false); expect(await writing).toBe(false); });
    expect(result.current.error).toMatch(/Could not/);
    expect(result.current.isSaving).toBeNull();
    expect(result.current.blobs[key]).toBe(files[key]);
  });

  test('load rejection reports error instead of empty success', async () => {
    listStorageKeys.mockRejectedValue(new Error('IDB unavailable'));
    const { result } = await clips();
    expect(result.current.error).toMatch(/IDB unavailable/);
  });

  // v4.131.0: the IDB store is shared with non-audio values (captions array,
  // last-call archive object). loadAllBlobs must skip them, not throw.
  test('non-audio IDB entries (captions/archive) are skipped, not thrown', async () => {
    files.catint_captions_v2 = [{ text: 'hello' }]; // not a Blob → loadFile null
    // Real IDB returns the array raw; storage is automocked so set it explicitly.
    loadRawValue.mockImplementation(async (k) => files[k]);
    const { result } = await clips();
    expect(result.current.error).toBeNull();
    expect(result.current.blobs[key]).toBeDefined();
    expect(result.current.blobs.catint_captions_v2).toBeUndefined();
  });

  // v4.133.1 fail-soft: a recording whose blob is gone must not fail the whole
  // load — remaining clips still show and the bad key is reported as a warning.
  test('unreadable recording key warns but other clips still load', async () => {
    files.greeting_es_morning = blob();
    loadFile.mockImplementation(async (k) => (k === key ? null : files[k] || null));
    const { result } = await clips();
    expect(result.current.error).toMatch(/missing or unreadable/);
    expect(result.current.error).toContain(key);
    expect(result.current.blobs.greeting_es_morning).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  // The exact prod failure (v4.133.1): a corrupt captions value makes even the
  // raw read fail (loadRawValue → undefined). Known non-audio keys must be
  // skipped outright — the editor loads with no error at all.
  test('unreadable captions value never errors the greeting editor', async () => {
    listStorageKeys.mockResolvedValue(['catint_captions_v2', 'catint_last_call_v1', key]);
    const { result } = await clips();
    expect(result.current.error).toBeNull();
    expect(result.current.blobs[key]).toBeDefined();
  });

  test('decode rejection closes its context', async () => {
    const close = jest.fn().mockResolvedValue();
    window.AudioContext = jest.fn(() => ({ close, decodeAudioData: jest.fn().mockRejectedValue(new Error('bad audio')) }));
    await expect(analyzeClipAudio({ arrayBuffer: async () => new ArrayBuffer(4) })).rejects.toThrow('bad audio');
    expect(close).toHaveBeenCalledTimes(1);
  });
});

let stream, track, ctx, recorder, onSaved;
const setupRecorder = () => {
  track = { stop: jest.fn() };
  stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue(stream) } });
  ctx = {
    close: jest.fn().mockResolvedValue(),
    createAnalyser: jest.fn(() => ({ frequencyBinCount: 128, getByteFrequencyData: jest.fn() })),
    createMediaStreamSource: jest.fn(() => ({ connect: jest.fn() })),
  };
  window.AudioContext = jest.fn(() => ctx);
  recorder = {
    state: 'inactive', mimeType: 'audio/webm',
    start: jest.fn(() => { recorder.state = 'recording'; }),
    stop: jest.fn(() => { recorder.state = 'inactive'; }),
  };
  window.MediaRecorder = jest.fn(() => recorder);
  window.MediaRecorder.isTypeSupported = jest.fn(() => true);
  jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  onSaved = jest.fn().mockResolvedValue(true);
};
const recordHook = (props = {}) => renderHook(() => useGreetingRecorder({ onSaved, ...props }));
const start = async (result) => act(async () => { await result.current.startRecording(key); });
const deliverStop = async () => {
  recorder.ondataavailable?.({ data: blob() });
  await recorder.onstop?.();
};



describe('async clip races', () => {
  test('a replaced clip cannot regain stale decode verdicts', async () => {
    const pending = deferred();
    const close = jest.fn().mockResolvedValue();
    window.AudioContext = jest.fn(() => ({ close, decodeAudioData: jest.fn(() => pending.promise) }));
    files[key] = { size: 5, arrayBuffer: async () => new ArrayBuffer(4) };
    const { result } = await clips();
    await waitFor(() => expect(window.AudioContext).toHaveBeenCalled());
    expect(result.current.isDecoding).toBe(true);
    await act(async () => { await result.current.uploadFile(key, blob()); });
    await act(async () => {
      pending.resolve({ getChannelData: () => new Float32Array(100), sampleRate: 48000 });
    });
    expect(result.current.waveforms[key]).toBeUndefined();
    expect(result.current.loudness[key]).toBeUndefined();
    expect(result.current.chop[key]).toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('a late reload cannot overwrite a newer reload', async () => {
    const { result } = await clips();
    const pending = deferred();
    listStorageKeys.mockReturnValueOnce(pending.promise);
    let older;
    act(() => { older = result.current.reloadData(); });
    files = { other: blob() };
    await act(async () => { await result.current.reloadData(); });
    await act(async () => { pending.resolve([]); await older; });
    expect(result.current.blobs).toEqual(files);
  });
});


