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
  shiftEarEnabled: true,
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
    get shiftEarEnabled() {
      return session.shiftEarEnabled;
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
// The shift-ear budget knobs, so the loop test asserts against real numbers.
import { EAR_REARM_MAX, EAR_RELEASE_IDLE_MS } from '../utils/shiftEar';

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

  /** A NETWORK drop: no CloseStream was sent — Deepgram decided to go. */
  die() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1006, reason: 'network' });
  }

  send(data) {
    this.sent.push(data);
  }

  /** Our own teardown: CloseStream first, then a clean code-1000 close. */
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
  // Opt-in per test: the legacy cases above were written against the pre-4.171
  // behaviour (no ear at all unless auto-connect is on).
  session.shiftEarEnabled = false;
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

/**
 * v4.172.0 SHIFT EAR. The claim under test is narrow and cheap to hold: keeping
 * a pair warm off-call must never start the recorder (no audio leaves the
 * machine = $0, no phantom minutes), and an off-call socket death must stop
 * resetting the app to DISCONNECTED.
 */
describe('shift ear keeps one pair warm all shift (v4.172.0)', () => {
  const openFrom = async (from) => {
    await act(async () => {
      FakeSocket.instances.slice(from).forEach((s) => s.open());
    });
  };

  /**
   * Advance real time on a network that ANSWERS: every KeepAlive tick, any socket
   * still mid-handshake completes. Without this a rotated pair sits in
   * CONNECTING forever, which is a different (and separately tested) failure.
   */
  const liveNetworkFor = async (ms) => {
    for (let t = 0; t < ms; t += 4000) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        FakeSocket.instances.filter((s) => s.readyState === 0).forEach((s) => s.open());
      });
    }
  };

  it('stays connected after STOP with no auto-start flag — and sends no audio', async () => {
    session.shiftEarEnabled = true;
    const { result } = renderHook(() => useDeepgram());
    await pressAndOpen(result);
    expect(result.current.sttLive).toBe(true);
    const recordersAfterConnect = FakeRecorder.instances.length;

    await act(async () => {
      result.current.stopRecording();
    });

    // The pair survives, so the next call starts from an open socket.
    expect(result.current.connectionState).toBe('connected');
    // Nothing is streaming: a warm pair has NO recorder, or clinic chatter would
    // be billed and banked as work that never happened (v4.99.2: 893 minutes).
    expect(FakeRecorder.instances).toHaveLength(recordersAfterConnect);
    expect(result.current.sttLive).toBe(false);
    expect(result.current.connectProgress.audioChunksSent).toBe(false);
  });

  it('re-arms a pair that dies off-call with no operator press', async () => {
    session.shiftEarEnabled = true;
    const { result } = renderHook(() => useDeepgram());
    await pressAndOpen(result);
    await act(async () => {
      result.current.stopRecording();
    });

    const before = FakeSocket.instances.length;
    // A network drop (1006), not our CloseStream: Deepgram decided to go.
    await act(async () => {
      FakeSocket.instances.slice(-2).forEach((s) => s.die());
    });

    expect(FakeSocket.instances.length).toBeGreaterThan(before);
    // The bug this fixes: off-call, the app fell to `disconnected` and went
    // deaf, so the next call needed a CONNECT press.
    expect(result.current.connectionState).toBe('connected');

    // The re-armed pair is a KEEPALIVE pair: opening it must not start audio.
    const recordersBefore = FakeRecorder.instances.length;
    await openFrom(before);
    expect(FakeRecorder.instances).toHaveLength(recordersBefore);
    expect(result.current.sttLive).toBe(false);
  });

  it('gives up honestly after the re-arm budget instead of looping forever', async () => {
    session.shiftEarEnabled = true;
    const { result } = renderHook(() => useDeepgram());
    await pressAndOpen(result);
    await act(async () => {
      result.current.stopRecording();
    });

    const before = FakeSocket.instances.length;
    // Every re-arm leaves a pair that never handshakes (network down), so the
    // next tick dies on it too.
    for (let i = 0; i < EAR_REARM_MAX + 4; i += 1) {
      const live = FakeSocket.instances.slice(before).filter((s) => s.readyState !== 3);
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        live.forEach((s) => s.die());
      });
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
    }

    const attempts = FakeSocket.instances.length - before;
    expect(attempts).toBeLessThanOrEqual(EAR_REARM_MAX * 2 + 2);
    expect(result.current.connectionMessage).toMatch(/press CONNECT/i);
  });

  it('hands the pair back after an hour of silence but keeps listening', async () => {
    session.shiftEarEnabled = true;
    const { result } = renderHook(() => useDeepgram());
    await pressAndOpen(result);
    await act(async () => {
      result.current.stopRecording();
    });

    // A healthy network: the pair rotated at 45min handshakes properly, so what
    // is released at the hour is a live socket, not a half-open one.
    await liveNetworkFor(EAR_RELEASE_IDLE_MS + 8000);

    // Socket given back (nothing held overnight) and freed properly: Deepgram
    // stops counting the stream now, not ~10s later.
    expect(FakeSocket.instances.every((s) => s.readyState === 3)).toBe(true);
    expect(FakeSocket.instances.some((s) => s.saidGoodbye())).toBe(true);
    // The EAR is still armed: the next call is a press, not a cold reconnect.
    expect(result.current.connectionState).toBe('connected');
    expect(result.current.connectProgress.socketEn).toBe('skipped');
    expect(result.current.sttLive).toBe(false);
    // And it never streamed: an hour of idle must not bill Deepgram or bank
    // minutes that were not worked (v4.99.2: 893 phantom minutes).
    expect(result.current.connectProgress.audioChunksSent).toBe(false);
  });

  it('a press after a release still gets a working call pair', async () => {
    session.shiftEarEnabled = true;
    const { result } = renderHook(() => useDeepgram());
    await pressAndOpen(result);
    await act(async () => {
      result.current.stopRecording();
    });
    await act(async () => {
      jest.advanceTimersByTime(EAR_RELEASE_IDLE_MS + 8000);
    });

    const { ok } = await pressAndOpen(result);
    expect(ok).toBe(true);
    expect(result.current.sttLive).toBe(true);
    expect(FakeRecorder.instances).toHaveLength(2);
  });
});
