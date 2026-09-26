/**
 * v4.153.0 — Deepgram must ACTUALLY start when CONNECT is pressed.
 *
 * Three regressions guarded here:
 *  1. EN and ES sockets opened in sequence (ES inside EN's onopen), so one hung
 *     socket meant no recorder, no audio, no error.
 *  2. `connectionState === 'connected'` was treated as "Deepgram is live" while
 *     idle-ear sits in that state with NO recorder — CONNECT then started a
 *     call that could never transcribe.
 *  3. A stale stream (share ended / all tracks muted) was reused as-is, so the
 *     sockets opened onto silence.
 */
import { act, renderHook } from '@testing-library/react';

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    updateActivity: jest.fn(),
    updateEnglishActivity: jest.fn(),
    isCallDetectionEnabled: false,
    requestHoldIntent: jest.fn(),
    clearHoldIntent: jest.fn(),
    captions: [],
    updateCaptions: jest.fn(),
    clearCaptions: jest.fn(),
    isCaptionsLoaded: true,
    isActive: false,
    isZombieCall: false,
    isHold: false,
    hipaaGraceActiveRef: { current: false },
    notifySpeechDuringCall: jest.fn(),
    trySpeechAutoStart: () => false,
    tryAutopilotStart: () => false,
    requestAutopilotEnd: jest.fn(),
    armAutopilotFarewell: jest.fn(),
    callAutopilotRef: { current: false },
    speechAutoConnect: false,
  }),
}));

jest.mock('../utils/deepgramRuntimeKey', () => ({
  getEffectiveDeepgramKey: () => 'test-key-0123456789',
  getDeepgramKeyInfo: () => ({ key: 'test-key-0123456789', source: 'test', masked: 'test' }),
  needsUserSuppliedDeepgramKey: () => false,
  isValidDeepgramApiKey: () => true,
}));

import { useDeepgram } from './useDeepgram';

const audioTrack = (over = {}) => ({
  kind: 'audio',
  readyState: 'live',
  muted: false,
  enabled: true,
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onended: null,
  ...over,
});

const fakeStream = (track = audioTrack()) => ({
  active: true,
  getAudioTracks: () => [track],
  getVideoTracks: () => [],
  getTracks: () => [track],
});

/** Minimal WebSocket double: open() flips readyState and fires onopen. */
class FakeSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: '' });
  }
}

class FakeRecorder {
  static instances = [];

  static isTypeSupported() {
    return true;
  }

  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.listeners = {};
    FakeRecorder.instances.push(this);
  }

  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
  }
}

let getUserMedia;
let getDisplayMedia;
let oldMediaDevices;
let oldWebSocket;
let oldMediaRecorder;
let oldMediaStream;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  FakeSocket.instances = [];
  FakeRecorder.instances = [];
  getUserMedia = jest.fn().mockResolvedValue(fakeStream());
  getDisplayMedia = jest.fn().mockResolvedValue(fakeStream());
  oldMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      getDisplayMedia,
      enumerateDevices: jest.fn().mockResolvedValue([{ kind: 'audioinput', deviceId: 'mic-1', label: 'Mic' }]),
    },
  });
  oldWebSocket = global.WebSocket;
  oldMediaRecorder = global.MediaRecorder;
  oldMediaStream = global.MediaStream;
  global.WebSocket = FakeSocket;
  global.MediaRecorder = FakeRecorder;
  // jsdom has no MediaStream — the audio-only stream is what the recorder eats.
  global.MediaStream = class {
    constructor(tracks) {
      this._tracks = tracks;
      this.active = true;
    }
    getAudioTracks() {
      return this._tracks;
    }
  };
});

afterEach(() => {
  if (oldMediaDevices) Object.defineProperty(navigator, 'mediaDevices', oldMediaDevices);
  else delete navigator.mediaDevices;
  global.WebSocket = oldWebSocket;
  global.MediaRecorder = oldMediaRecorder;
  global.MediaStream = oldMediaStream;
});

test('both language sockets open in parallel (no EN-chains-ES dependency)', async () => {
  const { result } = renderHook(() => useDeepgram());
  await act(async () => {
    await result.current.startRecording();
  });

  // Two sockets exist BEFORE anything opened — ES is not waiting on EN.
  expect(FakeSocket.instances).toHaveLength(2);

  // EN alone is not enough: still not live, no recorder, no audio.
  await act(async () => {
    FakeSocket.instances[0].open();
  });
  expect(result.current.sttLive).toBe(false);
  expect(FakeRecorder.instances).toHaveLength(0);

  // ES opens → recorder starts → sttLive is the truth.
  await act(async () => {
    FakeSocket.instances[1].open();
  });
  expect(FakeRecorder.instances).toHaveLength(1);
  expect(result.current.sttLive).toBe(true);
});

test('sttLive stays false when the sockets never open (no fake "connected")', async () => {
  const { result } = renderHook(() => useDeepgram());
  await act(async () => {
    await result.current.startRecording();
  });
  expect(FakeRecorder.instances).toHaveLength(0);
  expect(result.current.sttLive).toBe(false);
});

test('a dead share is refused with a message, then re-picked on the next press', async () => {
  getDisplayMedia
    .mockResolvedValueOnce(fakeStream(audioTrack({ readyState: 'ended' }))) // share died
    .mockResolvedValueOnce(fakeStream());
  const { result } = renderHook(() => useDeepgram());

  // Press 1: the share is already dead → no sockets, honest message.
  let ok = true;
  await act(async () => {
    ok = await result.current.startRecording();
  });
  expect(ok).toBe(false);
  expect(FakeSocket.instances).toHaveLength(0);
  expect(result.current.connectionState).toBe('error');

  // Press 2: re-picks the tab and this time Deepgram really starts.
  await act(async () => {
    ok = await result.current.startRecording();
  });
  await act(async () => {
    FakeSocket.instances.forEach((s) => s.open());
  });
  expect(ok).toBe(true);
  expect(result.current.sttLive).toBe(true);

  // Press 3: the good stream is reused — no new picker, no new wait.
  await act(async () => {
    await result.current.startRecording();
  });
  expect(getDisplayMedia).toHaveBeenCalledTimes(2);
});

test('a fully muted share is re-picked, not reused (mute = the silent call)', async () => {
  getDisplayMedia
    .mockResolvedValueOnce(fakeStream(audioTrack({ muted: true }))) // share went quiet
    .mockResolvedValueOnce(fakeStream());
  const { result } = renderHook(() => useDeepgram());

  await act(async () => {
    await result.current.startRecording();
  });
  // Second press: the muted stream is worthless, so the tab is re-picked.
  await act(async () => {
    await result.current.startRecording();
  });
  expect(getDisplayMedia).toHaveBeenCalledTimes(2);
});

test('closing the sockets clears sttLive again', async () => {
  const { result } = renderHook(() => useDeepgram());
  await act(async () => {
    await result.current.startRecording();
  });
  await act(async () => {
    FakeSocket.instances.forEach((s) => s.open());
  });
  expect(result.current.sttLive).toBe(true);

  await act(async () => {
    result.current.stopRecording();
  });
  expect(result.current.sttLive).toBe(false);
});
