/**
 * v4.170.0 — one CONNECT press must end with Deepgram actually transcribing.
 *
 * Live-call failures that each cost the operator a manual ZAP:
 *  1. The idle ear survived a CONNECT press. Its 4s KeepAlive saw "both
 *     sockets dead" (the new pair was still mid-handshake), called
 *     closeConnections() and reset the app to `disconnected` seconds after a
 *     CONNECT press that was about to succeed.
 *  2. Sockets were dropped without CloseStream, so Deepgram kept counting them
 *     as live streams for ~10s. A few presses stacked up to the concurrency
 *     cap and Deepgram answered the NEW sockets with silence.
 *  3. Sockets open + our recorder never emitted a chunk = red TIMEOUT, and a
 *     socket Zap cannot fix a dead MediaRecorder. The 12s watchdog now rebuilds
 *     the recorder on the SAME sockets instead.
 *  4. A recorder that died MID-call: shouldAutoZap() rightly refuses to Zap
 *     (sockets are fine), so nothing recovered it — the app sat 'connected' and
 *     silent for the rest of the call.
 */
import { act, renderHook } from '@testing-library/react';

const session = {
  speechAutoConnect: false,
  isActive: false,
};

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
    get isActive() {
      return session.isActive;
    },
    isZombieCall: false,
    isHold: false,
    hipaaGraceActiveRef: { current: false },
    notifySpeechDuringCall: jest.fn(),
    trySpeechAutoStart: () => false,
    tryAutopilotStart: () => false,
    requestAutopilotEnd: jest.fn(),
    armAutopilotFarewell: jest.fn(),
    callAutopilotRef: { current: false },
    get speechAutoConnect() {
      return session.speechAutoConnect;
    },
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

/** WebSocket double: open()/close() drive readyState + handlers by hand. */
class FakeSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    this.closedWith = null;
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  send(data) {
    this.sent.push(data);
  }

  close(code = 1000, reason = '') {
    this.closedWith = code;
    this.readyState = 3; // CLOSED
    this.onclose?.({ code, reason });
  }

  /** Deepgram frees the stream only if we say goodbye. */
  saidGoodbye() {
    return this.sent.some((m) => String(m).includes('"CloseStream"'));
  }

  /** Any message (even Metadata) proves the pipe is alive. */
  deliverMetadata() {
    this.onmessage?.({ data: JSON.stringify({ type: 'Metadata', channels: 1 }) });
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

  /** Chrome emits chunks through silence too — silence means a DEAD recorder. */
  emitChunk(bytes = 320) {
    this.listeners.dataavailable?.({
      data: {
        size: bytes,
        type: 'audio/webm',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
      },
    });
  }
}

let getDisplayMedia;
let oldMediaDevices;
let oldWebSocket;
let oldMediaRecorder;
let oldMediaStream;

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  FakeSocket.instances = [];
  FakeRecorder.instances = [];
  session.speechAutoConnect = false;
  session.isActive = false;
  getDisplayMedia = jest.fn().mockResolvedValue(fakeStream());
  oldMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue(fakeStream()),
      getDisplayMedia,
      enumerateDevices: jest
        .fn()
        .mockResolvedValue([{ kind: 'audioinput', deviceId: 'mic-1', label: 'Mic' }]),
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
  jest.useRealTimers();
});

/** Press CONNECT, then open only the sockets that press created. */
const pressAndOpen = async (result) => {
  const before = FakeSocket.instances.length;
  let ok;
  await act(async () => {
    ok = await result.current.startRecording();
  });
  const fresh = FakeSocket.instances.slice(before);
  await act(async () => {
    fresh.forEach((s) => s.open());
  });
  return { ok, fresh };
};

describe('CONNECT press vs the idle ear (v4.170.0)', () => {
  it('the ear a press replaces can no longer reset the app to disconnected', async () => {
    session.speechAutoConnect = true;
    const { result } = renderHook(() => useDeepgram());
    await pressAndOpen(result);
    expect(result.current.sttLive).toBe(true);

    // STOP keeps the sockets warm and opens the ear (KeepAlive only = $0).
    await act(async () => {
      result.current.stopRecording();
    });
    expect(result.current.connectionState).toBe('connected');
    expect(result.current.sttLive).toBe(false);

    // CONNECT again, and this time let the OLD ear's 4s KeepAlive fire while
    // the new pair is still mid-handshake (readyState 0). The ear used to see
    // "both sockets dead", call closeConnections() and stamp `disconnected`
    // over an attempt that was about to succeed — the chip lied, and the fix
    // operators learned was press ZAP.
    const before = FakeSocket.instances.length;
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      jest.advanceTimersByTime(4500);
    });
    expect(result.current.connectionState).not.toBe('disconnected');

    await act(async () => {
      FakeSocket.instances.slice(before).forEach((s) => s.open());
    });
    expect(result.current.sttLive).toBe(true);
    expect(result.current.connectionState).toBe('connected');
  });

  it('a press never leaves a live stream behind on the Deepgram account', async () => {
    const { result } = renderHook(() => useDeepgram());
    const { fresh } = await pressAndOpen(result);
    await act(async () => {
      result.current.stopRecording();
    });
    // Each press opens 2 streams; orphans count against the concurrency cap
    // for ~10s, and past it Deepgram answers the new sockets with silence.
    expect(fresh.length).toBe(2);
    expect(fresh.every((s) => s.saidGoodbye())).toBe(true);
    expect(fresh.every((s) => s.closedWith === 1000)).toBe(true);
  });
});

describe('CONNECT watchdog when our audio never starts (v4.170.0)', () => {
  it('rebuilds the recorder on the live sockets instead of failing red', async () => {
    const { result } = renderHook(() => useDeepgram());
    const { fresh } = await pressAndOpen(result);
    expect(FakeRecorder.instances).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(12_000);
    });

    expect(result.current.connectionState).not.toBe('error');
    expect(FakeRecorder.instances).toHaveLength(2);
    // Same sockets: a silent recorder is not a socket fault, so no churn.
    expect(fresh.every((s) => s.readyState === 1)).toBe(true);
  });

  it('rebuilds a recorder that dies mid-call without Zapping the sockets', async () => {
    session.isActive = true;
    const { result } = renderHook(() => useDeepgram());
    const { fresh } = await pressAndOpen(result);
    await act(async () => {
      FakeRecorder.instances[0].emitChunk();
      fresh.forEach((s) => s.deliverMetadata());
    });
    expect(result.current.sttLive).toBe(true);

    // 15s of zero chunks while "connected" — a live recorder encodes silence.
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });

    expect(FakeRecorder.instances.length).toBeGreaterThan(1);
    expect(result.current.connectionState).toBe('connected');
    expect(fresh.every((s) => s.readyState === 1)).toBe(true);
  });
});

describe('a failing press cannot fail the NEXT press (v4.170.0)', () => {
  it('a close from the previous attempt does not paint an error over a live one', async () => {
    const { result } = renderHook(() => useDeepgram());
    const before = FakeSocket.instances.length;
    await act(async () => {
      await result.current.startRecording();
    });
    // Attempt 1 never handshakes; Deepgram rejects it. onclose schedules the
    // failure on a single global 120ms timer.
    await act(async () => {
      FakeSocket.instances.slice(before).forEach((s) => s.close(1008, 'Unauthorized'));
    });

    // The operator presses CONNECT again BEFORE that timer fires. The old
    // timer did not know which attempt it belonged to, so it failed attempt 2
    // 120ms into a handshake that was about to succeed.
    const second = FakeSocket.instances.length;
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.connectionState).not.toBe('error');

    await act(async () => {
      FakeSocket.instances.slice(second).forEach((s) => {
        s.open();
        s.deliverMetadata();
      });
    });
    expect(result.current.sttLive).toBe(true);
    expect(result.current.connectionState).toBe('connected');
  });
});
