/**
 * v4.151.1 regression guard: a CONNECT attempt must acquire the route the UI
 * says is active.
 *
 * Commit e8e02cb (v4.84, "restore active tab and VB-Cable controls") dropped the
 * mic branch from startRecording / startRecordingFresh. With mic mode on, the
 * app then asked for tab audio (getDisplayMedia picker) or VB-Cable instead of
 * the microphone, so Deepgram never started.
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

import { useDeepgram } from './useDeepgram';
import {
  AUDIO_SOURCE_MODE_KEY,
  VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY,
} from '../utils/audioSourceManager';

const audioTrack = () => ({
  kind: 'audio',
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onended: null,
});

const fakeStream = () => ({
  active: true,
  getAudioTracks: () => [audioTrack()],
  getVideoTracks: () => [],
  getTracks: () => [audioTrack()],
});

let getUserMedia;
let getDisplayMedia;
let oldMediaDevices;

beforeEach(() => {
  localStorage.clear();
  getUserMedia = jest.fn().mockResolvedValue(fakeStream());
  getDisplayMedia = jest.fn().mockResolvedValue(fakeStream());
  oldMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      getDisplayMedia,
      enumerateDevices: jest.fn().mockResolvedValue([
        { kind: 'audioinput', deviceId: 'cable-out', label: 'CABLE Output' },
      ]),
    },
  });
});

afterEach(() => {
  if (oldMediaDevices) Object.defineProperty(navigator, 'mediaDevices', oldMediaDevices);
  else delete navigator.mediaDevices;
});

test('CONNECT in mic mode acquires the microphone, never a tab picker', async () => {
  const { result } = renderHook(() => useDeepgram());
  await act(async () => {
    result.current.setMicTestMode(true);
  });
  await act(async () => {
    await result.current.startRecording();
  });
  expect(getUserMedia).toHaveBeenCalled();
  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(result.current.attachedAudioSourceMode).toBe('mic');
});

test('CONNECT in virtual-cable mode acquires the cable, never a tab picker', async () => {
  localStorage.setItem(AUDIO_SOURCE_MODE_KEY, 'virtualCable');
  localStorage.setItem(VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY, 'cable-out');
  const { result } = renderHook(() => useDeepgram());
  await act(async () => {
    await result.current.startRecording();
  });
  expect(getUserMedia).toHaveBeenCalled();
  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(result.current.attachedAudioSourceMode).toBe('virtualCable');
});

test('CONNECT in tab mode acquires tab audio, never the microphone', async () => {
  const { result } = renderHook(() => useDeepgram());
  await act(async () => {
    await result.current.startRecording();
  });
  expect(getDisplayMedia).toHaveBeenCalled();
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(result.current.attachedAudioSourceMode).toBe('tab');
});
