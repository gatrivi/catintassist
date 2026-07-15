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
  isVbCableSinkLabel,
  isVbCableSttInputLabel,
  pickVbCableSinkDevice,
  pickVbCableSttInputDevice,
  diagnoseVbCableRoute,
  canUseTabCapture,
  classifyTabCaptureError,
  isTabCaptureUserCancel,
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

  test("pick helpers choose cable devices from lists", () => {
    const inputs = [
      { deviceId: "mic1", label: "Realtek Mic", kind: "audioinput" },
      { deviceId: "cable-out", label: "CABLE Output (VB-Audio Virtual Cable)", kind: "audioinput" },
    ];
    const outputs = [
      { deviceId: "spk1", label: "Speakers", kind: "audiooutput" },
      { deviceId: "cable-in", label: "CABLE Input (VB-Audio Virtual Cable)", kind: "audiooutput" },
    ];
    expect(pickVbCableSttInputDevice(inputs)).toBe("cable-out");
    expect(pickVbCableSinkDevice(outputs)).toBe("cable-in");
  });

  test("VB-Cable device label helpers distinguish in vs out", () => {
    expect(isVbCableSttInputLabel("CABLE Output (VB-Audio Virtual Cable)")).toBe(true);
    expect(isVbCableSttInputLabel("CABLE Input (VB-Audio Virtual Cable)")).toBe(false);
    expect(isVbCableSinkLabel("CABLE Input (VB-Audio Virtual Cable)")).toBe(true);
    expect(isVbCableSinkLabel("CABLE Output (VB-Audio Virtual Cable)")).toBe(false);
  });

  test("diagnoseVbCableRoute flags speakers as VB out", () => {
    const d = diagnoseVbCableRoute({
      cableMode: true,
      sttInputLabel: "CABLE Output (VB-Audio Virtual Cable)",
      sinkLabel: "Speakers (Realtek)",
      sinkId: "spk1",
    });
    expect(d.ok).toBe(false);
    expect(d.code).toBe("sink_is_speakers");
    expect(d.tip).toMatch(/CABLE Input/i);
  });

  test("diagnoseVbCableRoute flags swapped cable sides", () => {
    const sinkOut = diagnoseVbCableRoute({
      cableMode: true,
      sttInputLabel: "CABLE Output (VB-Audio Virtual Cable)",
      sinkLabel: "CABLE Output (VB-Audio Virtual Cable)",
      sinkId: "out",
    });
    expect(sinkOut.code).toBe("sink_is_cable_output");

    const sttIn = diagnoseVbCableRoute({
      cableMode: true,
      sttInputLabel: "CABLE Input (VB-Audio Virtual Cable)",
      sinkLabel: "CABLE Input (VB-Audio Virtual Cable)",
      sinkId: "in",
    });
    expect(sttIn.code).toBe("stt_is_cable_input");
  });

  test("diagnoseVbCableRoute ok when Input/Output correct", () => {
    const d = diagnoseVbCableRoute({
      cableMode: true,
      sttInputLabel: "CABLE Output (VB-Audio Virtual Cable)",
      sinkLabel: "CABLE Input (VB-Audio Virtual Cable)",
      sinkId: "in",
    });
    expect(d.ok).toBe(true);
    expect(d.code).toBe("ok");
  });

  test("tab share cancel is detected", () => {
    const err = { name: "AbortError", message: "The user aborted a request." };
    expect(isTabCaptureUserCancel(err)).toBe(true);
    expect(isTabCaptureUserCancel({ name: "NotAllowedError" })).toBe(false);
  });
});

