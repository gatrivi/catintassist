import {
  AUDIO_SOURCE_MODE_TAB,
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  AUDIO_SOURCE_MODE_KEY,
  VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY,
  readAudioSourceMode,
  persistAudioSourceMode,
  readSelectedVirtualCableInputDeviceId,
  persistSelectedVirtualCableInputDeviceId,
  buildVirtualCableGetUserMediaConstraints,
  buildVirtualCableFailureUiState,
  getAudioSourceModeAfterVirtualCableFailure,
  canUseTabCapture,
  classifyTabCaptureError,
  isLikelyEmbeddedPreviewBrowser,
} from "./audioSourceManager";

describe("audioSourceManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("default mode remains tab when unset", () => {
    expect(readAudioSourceMode()).toBe(AUDIO_SOURCE_MODE_TAB);
  });

  test("virtual cable mode builds getUserMedia constraints", () => {
    const constraints = buildVirtualCableGetUserMediaConstraints("dev-123");
    expect(constraints.video).toBe(false);
    expect(constraints.audio.echoCancellation).toBe(false);
    expect(constraints.audio.noiseSuppression).toBe(false);
    expect(constraints.audio.autoGainControl).toBe(false);
    expect(constraints.audio.channelCount).toBe(1);
    expect(constraints.audio.deviceId).toEqual({ exact: "dev-123" });
  });

  test("virtual cable constraints allow undefined deviceId", () => {
    const constraints = buildVirtualCableGetUserMediaConstraints("");
    expect(constraints.video).toBe(false);
    expect(constraints.audio.deviceId).toBe(undefined);
  });

  test("selected deviceId is persisted", () => {
    persistSelectedVirtualCableInputDeviceId("cable-out");
    expect(readSelectedVirtualCableInputDeviceId()).toBe("cable-out");
    expect(localStorage.getItem(VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY)).toBe("cable-out");
  });

  test("mode persists as expected", () => {
    persistAudioSourceMode(AUDIO_SOURCE_MODE_VIRTUAL_CABLE);
    expect(readAudioSourceMode()).toBe(AUDIO_SOURCE_MODE_VIRTUAL_CABLE);
    expect(localStorage.getItem(AUDIO_SOURCE_MODE_KEY)).toBe(AUDIO_SOURCE_MODE_VIRTUAL_CABLE);
  });

  test("virtual cable failure UI state is produced", () => {
    const ui = buildVirtualCableFailureUiState(new Error("Denied"));
    expect(ui.kind).toBe("virtualCableFailure");
    expect(ui.message).toMatch(/Virtual cable input failed/i);
    expect(ui.suggestedActionLabel).toMatch(/Tab share/i);
  });

  test("virtual cable failure does not overwrite stored mode", () => {
    persistAudioSourceMode(AUDIO_SOURCE_MODE_TAB);
    const currentMode = readAudioSourceMode();
    const nextMode = getAudioSourceModeAfterVirtualCableFailure(currentMode);
    expect(nextMode).toBe(AUDIO_SOURCE_MODE_TAB);
  });

  test("classify NotSupportedError suggests mic fallback", () => {
    const err = { name: "NotSupportedError", message: "Not supported" };
    const out = classifyTabCaptureError(err);
    expect(out.suggestMicFallback).toBe(true);
    expect(out.message).toMatch(/not supported|Chrome/i);
  });

  test("canUseTabCapture is false without getDisplayMedia", () => {
    expect(canUseTabCapture({ getUserMedia: () => {} })).toBe(false);
    expect(
      canUseTabCapture({ getDisplayMedia: () => {}, getUserMedia: () => {} }),
    ).toBe(true);
  });
});

