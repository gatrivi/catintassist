import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { AudioSettingsProvider, useAudioSettings } from './AudioSettingsContext';
import { decodeBlobOnContext, getDirectSinkContext, playBufferDirect } from '../utils/audioRouteDirect';
import { decodeBlobToBuffer, playBufferViaPassthrough, ROUTE_MODE } from '../utils/audioRoutePassthrough';

jest.mock('../utils/audioRouteDirect', () => ({
  decodeBlobOnContext: jest.fn(),
  getDirectSinkContext: jest.fn(),
  playBufferDirect: jest.fn(),
}));
jest.mock('../utils/audioRoutePassthrough', () => ({
  ...jest.requireActual('../utils/audioRoutePassthrough'),
  decodeBlobToBuffer: jest.fn(),
  playBufferViaPassthrough: jest.fn(),
}));
jest.mock('../utils/routeDiagnostics', () => ({
  ...jest.requireActual('../utils/routeDiagnostics'),
  logRouteEvent: jest.fn(),
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

// Flush only microtasks; audio lifecycle boundaries remain controlled by each test.
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
const wrapper = ({ children }) => <AudioSettingsProvider>{children}</AudioSettingsProvider>;
const blob = new Blob(['greeting'], { type: 'audio/webm' });
const buffer = { duration: 2 };
let ctx;
let audio;
let oldMediaDevices;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('CATINTASSIST_SINK_ID', 'voicemeeter');
  oldMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: jest.fn().mockResolvedValue([
        { kind: 'audiooutput', deviceId: 'voicemeeter', label: 'Voicemeeter Input' },
        { kind: 'audiooutput', deviceId: 'other-cable', label: 'CABLE Input' },
      ]),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
  audio = { setSinkId: jest.fn().mockResolvedValue(), play: jest.fn().mockResolvedValue(), muted: false, volume: 1 };
  jest.spyOn(window, 'Audio').mockImplementation(() => audio);
  ctx = { resume: jest.fn().mockResolvedValue(), setSinkId: jest.fn().mockResolvedValue() };
  getDirectSinkContext.mockReset().mockReturnValue(ctx);
  decodeBlobOnContext.mockReset().mockResolvedValue(buffer);
  playBufferDirect.mockReset().mockImplementation(() => ({ promise: Promise.resolve(), stop: jest.fn() }));
  decodeBlobToBuffer.mockReset().mockResolvedValue({ ctx: {}, buffer });
  playBufferViaPassthrough.mockReset().mockImplementation(() => ({ promise: Promise.resolve(), stop: jest.fn() }));
});

afterEach(() => {
  jest.restoreAllMocks();
  if (oldMediaDevices) Object.defineProperty(navigator, 'mediaDevices', oldMediaDevices);
  else delete navigator.mediaDevices;
});

async function mountSettings() {
  const hook = renderHook(useAudioSettings, { wrapper });
  await act(flush);
  return hook;
}

test('each greeting waits for resume and output binding before rendering', async () => {
  const { result } = await mountSettings();
  const resumed = deferred();
  const bound = deferred();
  ctx.resume.mockReturnValueOnce(resumed.promise);
  ctx.setSinkId.mockReturnValueOnce(bound.promise);
  let playback;
  await act(async () => { playback = result.current.playClipToSink(blob, 0.4); await flush(); });
  expect(ctx.resume).toHaveBeenCalledTimes(1);
  expect(ctx.setSinkId).not.toHaveBeenCalled();
  expect(playBufferDirect).not.toHaveBeenCalled();
  await act(async () => { resumed.resolve(); await flush(); });
  expect(ctx.setSinkId).toHaveBeenCalledWith('voicemeeter');
  expect(playBufferDirect).not.toHaveBeenCalled();
  await act(async () => { bound.resolve(); await playback; });
  expect(playBufferDirect).toHaveBeenCalledWith(ctx, buffer, expect.objectContaining({ volume: 0.4 }));
  await act(async () => { await result.current.playClipToSink(blob); });
  expect(ctx.resume).toHaveBeenCalledTimes(2);
  expect(ctx.setSinkId.mock.calls.every(([sink]) => sink === 'voicemeeter')).toBe(true);
  expect(playBufferDirect).toHaveBeenCalledTimes(2);
  expect(playBufferViaPassthrough).not.toHaveBeenCalled();
});

test('unsupported direct output retains the selected-sink passthrough fallback', async () => {
  getDirectSinkContext.mockImplementation(() => { throw new Error('direct_sink_unsupported'); });
  const { result } = await mountSettings();
  let outcome;
  await act(async () => { outcome = await result.current.playClipToSink(blob); });
  expect(outcome).toEqual(expect.objectContaining({ ok: true, mode: ROUTE_MODE.PASSTHROUGH }));
  expect(playBufferViaPassthrough).toHaveBeenCalledWith(audio, buffer, expect.anything(), expect.objectContaining({ sinkId: 'voicemeeter' }));
});

test('changing output while decoding never sends the greeting to the old cable', async () => {
  const decoding = deferred();
  decodeBlobOnContext.mockReturnValueOnce(decoding.promise);
  const { result } = await mountSettings();
  let playback;
  await act(async () => { playback = result.current.playClipToSink(blob); await flush(); });
  expect(decodeBlobOnContext).toHaveBeenCalledTimes(1);
  act(() => result.current.changeSinkId('other-cable'));
  let outcome;
  await act(async () => { decoding.resolve(buffer); outcome = await playback; });
  expect(outcome).toEqual(expect.objectContaining({ ok: false, cancelled: true, reason: 'sink_changed' }));
  expect(playBufferDirect).not.toHaveBeenCalled();
  expect(playBufferViaPassthrough).not.toHaveBeenCalled();
  expect(result.current.sinkPlaybackActive).toBe(false);
});

test.each(['stopClipToSink', 'restoreLiveMic'])('%s cancels a greeting still decoding', async (stopAction) => {
  const decoding = deferred();
  decodeBlobOnContext.mockReturnValueOnce(decoding.promise);
  const { result } = await mountSettings();
  let playback;
  await act(async () => { playback = result.current.playClipToSink(blob); await flush(); });
  act(() => result.current[stopAction]());
  let outcome;
  await act(async () => { decoding.resolve(buffer); outcome = await playback; });
  expect(outcome).toEqual(expect.objectContaining({ ok: false, cancelled: true, reason: 'play_cancelled' }));
  expect(playBufferDirect).not.toHaveBeenCalled();
  expect(playBufferViaPassthrough).not.toHaveBeenCalled();
  expect(result.current.sinkPlaybackActive).toBe(false);
});

test('Stop during fallback decoding also prevents playback', async () => {
  getDirectSinkContext.mockImplementation(() => { throw new Error('direct_sink_unsupported'); });
  const decoding = deferred();
  decodeBlobToBuffer.mockReturnValueOnce(decoding.promise);
  const { result } = await mountSettings();
  let playback;
  await act(async () => { playback = result.current.playClipToSink(blob); await flush(); });
  expect(decodeBlobToBuffer).toHaveBeenCalledTimes(1);
  act(() => result.current.stopClipToSink());
  const fallbackCtx = { close: jest.fn().mockResolvedValue() };
  let outcome;
  await act(async () => { decoding.resolve({ ctx: fallbackCtx, buffer }); outcome = await playback; });
  expect(outcome).toEqual(expect.objectContaining({ ok: false, cancelled: true }));
  expect(fallbackCtx.close).toHaveBeenCalledTimes(1);
  expect(playBufferViaPassthrough).not.toHaveBeenCalled();
});

test('Stop during output binding prevents subsequent decoding and playback', async () => {
  const bound = deferred();
  ctx.setSinkId.mockReturnValueOnce(bound.promise);
  const { result } = await mountSettings();
  let playback;
  await act(async () => { playback = result.current.playClipToSink(blob); await flush(); });
  act(() => result.current.stopClipToSink());
  await act(async () => { bound.resolve(); await playback; });
  expect(decodeBlobOnContext).not.toHaveBeenCalled();
  expect(playBufferDirect).not.toHaveBeenCalled();
  expect(playBufferViaPassthrough).not.toHaveBeenCalled();
});

test('a superseded decode cannot interrupt a newer playing greeting', async () => {
  const oldDecode = deferred();
  const currentEnd = deferred();
  const stop = jest.fn(() => currentEnd.resolve());
  decodeBlobOnContext.mockReturnValueOnce(oldDecode.promise);
  playBufferDirect.mockReturnValue({ promise: currentEnd.promise, stop });
  const { result } = await mountSettings();
  let older;
  let newer;
  await act(async () => { older = result.current.playClipToSink(blob); await flush(); });
  await act(async () => { newer = result.current.playClipToSink(blob); await flush(); });
  expect(result.current.sinkPlaybackActive).toBe(true);
  await act(async () => { oldDecode.resolve(buffer); await flush(); });
  expect(playBufferDirect).toHaveBeenCalledTimes(1);
  expect(playBufferViaPassthrough).not.toHaveBeenCalled();
  expect(result.current.sinkPlaybackActive).toBe(true);
  await act(async () => { result.current.stopClipToSink(); await Promise.all([older, newer]); });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(result.current.sinkPlaybackActive).toBe(false);
});
