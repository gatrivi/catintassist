/**
 * Audio source selection utilities.
 *
 * Goal: keep existing tab-share flow as the default, and add an optional
 * “virtual cable / microphone device” input mode for VB-CABLE / Voicemeeter.
 */

export const AUDIO_SOURCE_MODE_TAB = "tab";
export const AUDIO_SOURCE_MODE_VIRTUAL_CABLE = "virtualCable";

export const AUDIO_SOURCE_MODE_KEY = "CATINTASSIST_AUDIO_SOURCE_MODE";
export const VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY =
  "CATINTASSIST_VIRTUAL_CABLE_INPUT_DEVICE_ID";

export const readAudioSourceMode = (storage = typeof localStorage !== "undefined" ? localStorage : null) => {
  try {
    if (!storage) return AUDIO_SOURCE_MODE_TAB;
    const raw = storage.getItem(AUDIO_SOURCE_MODE_KEY);
    if (raw === AUDIO_SOURCE_MODE_VIRTUAL_CABLE) return AUDIO_SOURCE_MODE_VIRTUAL_CABLE;
    return AUDIO_SOURCE_MODE_TAB;
  } catch (_) {
    return AUDIO_SOURCE_MODE_TAB;
  }
};

export const persistAudioSourceMode = (
  mode,
  storage = typeof localStorage !== "undefined" ? localStorage : null,
) => {
  try {
    if (!storage) return;
    const next = mode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE ? AUDIO_SOURCE_MODE_VIRTUAL_CABLE : AUDIO_SOURCE_MODE_TAB;
    storage.setItem(AUDIO_SOURCE_MODE_KEY, next);
  } catch (_) {}
};

export const readSelectedVirtualCableInputDeviceId = (
  storage = typeof localStorage !== "undefined" ? localStorage : null,
) => {
  try {
    if (!storage) return "";
    return storage.getItem(VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY) || "";
  } catch (_) {
    return "";
  }
};

export const persistSelectedVirtualCableInputDeviceId = (
  deviceId,
  storage = typeof localStorage !== "undefined" ? localStorage : null,
) => {
  try {
    if (!storage) return;
    storage.setItem(VIRTUAL_CABLE_INPUT_DEVICE_ID_KEY, deviceId || "");
  } catch (_) {}
};

/**
 * Build getUserMedia constraints for VB-CABLE / Voicemeeter-style “machine audio”.
 *
 * IMPORTANT:
 * - echoCancellation/noiseSuppression/autoGainControl must be DISABLED
 * - channelCount must be 1
 * - video must be false
 */
export const buildVirtualCableGetUserMediaConstraints = (selectedDeviceId) => {
  return {
    audio: {
      deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
    video: false,
  };
};

/**
 * Enumerate input devices and (if device labels are hidden/blank) prompt for
 * temporary audio permission and re-enumerate.
 */
export const refreshInputDevices = async ({
  enumerateDevicesFn,
  getUserMediaFn,
} = {}) => {
  const enumerate = enumerateDevicesFn || navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
  const getUserMedia = getUserMediaFn || navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  let devices = await enumerate();
  const inputDevices = devices.filter((d) => d.kind === "audioinput");

  // If labels are blank, request temporary audio permission and re-enumerate.
  const needsPermission = inputDevices.some((d) => !d.label);
  if (needsPermission) {
    try {
      const stream = await getUserMedia({ audio: true, video: false });
      stream.getTracks?.().forEach((t) => t.stop());
    } catch (_) {
      // Best-effort: if permission is denied, keep the blank labels list.
    }
    devices = await enumerate();
  }

  return devices.filter((d) => d.kind === "audioinput");
};

export const buildVirtualCableFailureUiState = (err) => {
  const base =
    "Virtual cable input failed. You can switch back to Tab share.";
  const details = err?.message ? ` (${err.message})` : "";
  return {
    kind: "virtualCableFailure",
    message: `${base}${details}`,
    suggestedActionLabel: "Switch back to Tab share",
  };
};

/**
 * Failure must be “boring and recoverable”.
 * We intentionally do NOT overwrite the stored mode on failure here.
 */
export const getAudioSourceModeAfterVirtualCableFailure = (currentMode) => currentMode;

/** Tab-share needs getDisplayMedia — missing in Cursor preview and some embedded WebViews. */
export const canUseTabCapture = (mediaDevices) => {
  const md = mediaDevices ?? (typeof navigator !== "undefined" ? navigator.mediaDevices : null);
  try {
    return !!(md && typeof md.getDisplayMedia === "function");
  } catch (_) {
    return false;
  }
};

export const isLikelyEmbeddedPreviewBrowser = () => {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    return /CursorBrowser/i.test(ua);
  } catch (_) {
    return false;
  }
};

/** Plain-language tab capture errors for Connect UI. */
export const classifyTabCaptureError = (err) => {
  const name = err?.name || "";
  const embedded = isLikelyEmbeddedPreviewBrowser();

  if (name === "NotSupportedError" || !canUseTabCapture()) {
    return {
      message: embedded
        ? "Tab capture is not available in Cursor's preview browser. Open catintassist.gatrivi.com in Chrome or Edge, or press 🎤 for mic mode."
        : "Tab audio capture is not supported in this browser. Use Chrome/Edge, or press 🎤 for microphone mode.",
      suggestMicFallback: true,
    };
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      message: "Tab sharing was blocked. Allow it in the browser prompt, or use 🎤 mic mode.",
      suggestMicFallback: true,
    };
  }
  if (name === "AbortError") {
    return {
      message: "Tab sharing was cancelled. Press Connect again and pick a tab with Share audio checked.",
      suggestMicFallback: false,
    };
  }
  return {
    message: err?.message
      ? `Tab capture failed: ${err.message}`
      : "Tab capture failed. Try 🎤 mic mode or open the app in Chrome/Edge.",
    suggestMicFallback: true,
  };
};

